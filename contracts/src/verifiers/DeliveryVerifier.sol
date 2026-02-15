// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    Generated with snarkJS from the HashDrop DeliveryProof circuit.
    This verifier checks Groth16 ZK proofs on the BN254 curve.

    Public signals: [valid, secretHash, orderId, courierAddress]
*/

pragma solidity ^0.8.24;

import "../interfaces/IDeliveryVerifier.sol";

contract DeliveryVerifier is IDeliveryVerifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 17403546104095698056976976757181921248675717340846772565765472168067699672554;
    uint256 constant alphay  = 6071990771125746040667942929390588836851430805824249530391781132485889175536;
    uint256 constant betax1  = 20114492511143565698796613134846874191147711328308565900708398581046055762451;
    uint256 constant betax2  = 13725022938421863376223070828601155838354854285883138160512452364323863833215;
    uint256 constant betay1  = 16156542525394271372219600314987927365934470711204418592201883884949319504474;
    uint256 constant betay2  = 3885308024631903528934722680415136229779170090870097480652042907730968696026;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 8868360057471950121661741762702559268524263057804920148194803814076221450460;
    uint256 constant deltax2 = 21115422325565008810224256688722003632285346065794054149272151494380852597639;
    uint256 constant deltay1 = 18511035043630822535637871709990357198373784421998081523741621563563020709197;
    uint256 constant deltay2 = 11373137727174641950831803414439819527524592619393840367546366302215486320546;

    uint256 constant IC0x = 12004997825433687885314134486836189721405144129039113216618132868153128148764;
    uint256 constant IC0y = 2985772192775073787709897471940890304522074501645221289182560774068812808118;

    uint256 constant IC1x = 8799448805052613241592182687821477716648706150566537440238984677005775733208;
    uint256 constant IC1y = 21146168451241289221989721560501789525019941378399679236319165897250049106114;

    uint256 constant IC2x = 18606922275345375759734217595165671792606748555963736364430746603941151796762;
    uint256 constant IC2y = 691863221611103273101341741535967766811104768945013870306057081955312766093;

    uint256 constant IC3x = 9758974533479730537888934648275971779394051101860583692320794002448831010336;
    uint256 constant IC3y = 14838534800806097002222914115258249103887778902941132810288847588225385598103;

    uint256 constant IC4x = 3977460509016067556665305114550204043583810261820082803775446233191852291943;
    uint256 constant IC4y = 5297857095116349414609447391132415567696881414743370213869985250381942322705;


    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[4] calldata _pubSignals
    ) external view override returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x

                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))

                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))

                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))

                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))


                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations are in F

            checkField(calldataload(add(_pubSignals, 0)))

            checkField(calldataload(add(_pubSignals, 32)))

            checkField(calldataload(add(_pubSignals, 64)))

            checkField(calldataload(add(_pubSignals, 96)))


            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
}

/// @title DeliveryVerifierMock
/// @notice Mock verifier for testing - always returns configurable result
contract DeliveryVerifierMock is IDeliveryVerifier {
    bool public shouldVerify = true;

    function setVerificationResult(bool result) external {
        shouldVerify = result;
    }

    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[4] calldata
    ) external view override returns (bool) {
        return shouldVerify;
    }
}
