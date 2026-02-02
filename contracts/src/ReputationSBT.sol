// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IReputationSBT.sol";

/// @title ReputationSBT - Soulbound Token de Reputacion
/// @notice Token intransferible que representa la reputacion del usuario en HashDrop
/// @dev Implementa ERC721 pero bloquea transferencias (Soulbound)
contract ReputationSBT is ERC721, AccessControl, IReputationSBT {
    // ============ Constants ============
    bytes32 public constant ESCROW_ROLE = keccak256("ESCROW_ROLE");

    uint256 public constant DECAY_PERIOD = 30 days;
    uint256 public constant DECAY_RATE_BPS = 500; // 5% por periodo
    uint256 public constant MAX_SCORE = 1000;
    uint256 public constant INITIAL_SCORE = 100;
    uint256 public constant SUCCESS_INCREMENT = 10;
    uint256 public constant FAILURE_PENALTY = 50;
    uint256 public constant DISPUTE_PENALTY = 200;

    // ============ State Variables ============
    uint256 public minCourierScore = 50;
    uint256 private _nextTokenId = 1;

    mapping(address => Reputation) private _reputations;
    mapping(address => uint256) private _tokenIds;

    // ============ Constructor ============
    constructor() ERC721("HashDrop Reputation", "HDREP") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ============ External Functions ============

    /// @notice Registrar usuario y mintear SBT
    /// @param asCourier True si se registra como mensajero
    /// @return tokenId El ID del token minteado
    function register(bool asCourier) external returns (uint256 tokenId) {
        if (_tokenIds[msg.sender] != 0) revert AlreadyRegistered();

        tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _tokenIds[msg.sender] = tokenId;

        _reputations[msg.sender] = Reputation({
            score: INITIAL_SCORE,
            totalDeliveries: 0,
            successfulDeliveries: 0,
            failedDeliveries: 0,
            disputes: 0,
            lastActivityTimestamp: block.timestamp,
            isCourier: asCourier,
            isActive: true
        });

        emit UserRegistered(msg.sender, asCourier, tokenId);
    }

    /// @notice Registrar entrega exitosa
    /// @param user Direccion del usuario
    function recordSuccessfulDelivery(address user) external onlyRole(ESCROW_ROLE) {
        Reputation storage rep = _reputations[user];
        if (!rep.isActive) revert NotRegistered();

        _applyDecay(user);

        rep.totalDeliveries++;
        rep.successfulDeliveries++;

        // Incremento proporcional (mas dificil mientras mas alto el score)
        uint256 increment = (SUCCESS_INCREMENT * (MAX_SCORE - rep.score)) / MAX_SCORE;
        if (increment == 0) increment = 1; // Minimo 1 punto

        rep.score = _min(rep.score + increment, MAX_SCORE);
        rep.lastActivityTimestamp = block.timestamp;

        emit ReputationUpdated(user, rep.score, rep.totalDeliveries);
    }

    /// @notice Registrar entrega fallida
    /// @param user Direccion del usuario
    function recordFailedDelivery(address user) external onlyRole(ESCROW_ROLE) {
        Reputation storage rep = _reputations[user];
        if (!rep.isActive) revert NotRegistered();

        _applyDecay(user);

        rep.totalDeliveries++;
        rep.failedDeliveries++;
        rep.score = rep.score > FAILURE_PENALTY ? rep.score - FAILURE_PENALTY : 0;
        rep.lastActivityTimestamp = block.timestamp;

        emit ReputationUpdated(user, rep.score, rep.totalDeliveries);
    }

    /// @notice Registrar disputa
    /// @param user Direccion del usuario
    /// @param wasAtFault True si el usuario fue culpable
    function recordDispute(address user, bool wasAtFault) external onlyRole(ESCROW_ROLE) {
        Reputation storage rep = _reputations[user];
        if (!rep.isActive) revert NotRegistered();

        rep.disputes++;

        if (wasAtFault) {
            rep.score = rep.score > DISPUTE_PENALTY ? rep.score - DISPUTE_PENALTY : 0;
        }

        emit DisputeRecorded(user, wasAtFault);
        emit ReputationUpdated(user, rep.score, rep.totalDeliveries);
    }

    // ============ View Functions ============

    /// @notice Obtener score actual con decay aplicado
    /// @param user Direccion del usuario
    /// @return Score actual
    function getReputationScore(address user) external view returns (uint256) {
        Reputation memory rep = _reputations[user];
        if (!rep.isActive) return 0;

        return _calculateDecayedScore(rep.score, rep.lastActivityTimestamp);
    }

    /// @notice Obtener toda la informacion de reputacion
    /// @param user Direccion del usuario
    /// @return Struct Reputation completo
    function getReputation(address user) external view returns (Reputation memory) {
        Reputation memory rep = _reputations[user];
        // Aplicar decay al score en la vista
        rep.score = _calculateDecayedScore(rep.score, rep.lastActivityTimestamp);
        return rep;
    }

    /// @notice Verificar si usuario esta registrado
    /// @param user Direccion del usuario
    /// @return True si esta registrado
    function isRegistered(address user) external view returns (bool) {
        return _reputations[user].isActive;
    }

    /// @notice Verificar si usuario cumple score minimo
    /// @param user Direccion del usuario
    /// @param minScore Score minimo requerido
    /// @return True si cumple
    function meetsMinimumScore(address user, uint256 minScore) external view returns (bool) {
        Reputation memory rep = _reputations[user];
        if (!rep.isActive) return false;

        uint256 currentScore = _calculateDecayedScore(rep.score, rep.lastActivityTimestamp);
        return currentScore >= minScore;
    }

    /// @notice Obtener token ID de un usuario
    /// @param user Direccion del usuario
    /// @return Token ID (0 si no registrado)
    function getTokenId(address user) external view returns (uint256) {
        return _tokenIds[user];
    }

    // ============ Admin Functions ============

    /// @notice Actualizar score minimo para mensajeros
    /// @param newMinScore Nuevo score minimo
    function setMinCourierScore(uint256 newMinScore) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minCourierScore = newMinScore;
    }

    /// @notice Otorgar rol de escrow a un contrato
    /// @param escrowContract Direccion del contrato escrow
    function grantEscrowRole(address escrowContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ESCROW_ROLE, escrowContract);
    }

    // ============ Internal Functions ============

    /// @dev Aplicar decay al score almacenado
    function _applyDecay(address user) internal {
        Reputation storage rep = _reputations[user];
        rep.score = _calculateDecayedScore(rep.score, rep.lastActivityTimestamp);
    }

    /// @dev Calcular score con decay aplicado
    function _calculateDecayedScore(
        uint256 score,
        uint256 lastActivity
    ) internal view returns (uint256) {
        if (lastActivity == 0 || score == 0) return score;

        uint256 periodsElapsed = (block.timestamp - lastActivity) / DECAY_PERIOD;
        if (periodsElapsed == 0) return score;

        uint256 decayedScore = score;
        for (uint256 i = 0; i < periodsElapsed && decayedScore > 0; i++) {
            decayedScore = (decayedScore * (10000 - DECAY_RATE_BPS)) / 10000;
        }

        return decayedScore;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    // ============ SBT: Bloquear transferencias ============

    /// @dev Override para bloquear transferencias (Soulbound)
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // Solo permitir mint (from == 0) o burn (to == 0)
        if (from != address(0) && to != address(0)) {
            revert TransferNotAllowed();
        }

        return super._update(to, tokenId, auth);
    }

    /// @dev Override para soportar interfaces
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
