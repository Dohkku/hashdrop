"use client";

import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { useState, useEffect } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  useOrder,
  OrderState,
  ORDER_STATE_LABELS,
  formatUSDC,
  useConfirmPickup,
  useConfirmDelivery,
  useInitiateDispute,
  useCancelOrder,
  useClaimExpiredOrder,
  getOrderExpiryTime,
  getPickupTimeoutTime,
  getDeliveryTimeoutTime,
  formatTimeRemaining,
} from "@/hooks/useEscrow";
import { useSignMessage } from "wagmi";
import { keccak256, encodePacked, toHex } from "viem";
import {
  generateDeliveryProof,
  formatProofForContract,
  secretToQRData,
  bytes32ToBigint,
} from "@/lib/zk";

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = BigInt(params.id as string);
  const { address, isConnected } = useAccount();
  const { data: order, isLoading, refetch } = useOrder(orderId);

  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [deliverySecret, setDeliverySecret] = useState("");
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [receiverSecret, setReceiverSecret] = useState("");

  // Hooks for actions
  const { confirmPickup, isPending: isPendingPickup } = useConfirmPickup();
  const { confirmDelivery, isPending: isPendingDelivery } = useConfirmDelivery();
  const { initiateDispute, isPending: isPendingDispute } = useInitiateDispute();
  const { cancelOrder, isPending: isPendingCancel } = useCancelOrder();
  const { claimExpiredOrder, isPending: isPendingClaim } = useClaimExpiredOrder();
  const { signMessageAsync } = useSignMessage();

  // Update time remaining every minute
  useEffect(() => {
    if (!order) return;

    const orderData = order as any;
    const state = orderData.state as OrderState;

    const updateTimer = () => {
      let targetTime: Date | null = null;

      switch (state) {
        case OrderState.OPEN:
          targetTime = getOrderExpiryTime(orderData.createdAt);
          break;
        case OrderState.LOCKED:
          targetTime = getPickupTimeoutTime(orderData.lockedAt);
          break;
        case OrderState.PICKED_UP:
          targetTime = getDeliveryTimeoutTime(orderData.pickedUpAt);
          break;
      }

      if (targetTime) {
        setTimeRemaining(formatTimeRemaining(targetTime));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [order]);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Conecta tu wallet para ver esta orden</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Orden no encontrada</p>
      </div>
    );
  }

  const orderData = order as any;
  const state = orderData.state as OrderState;
  const isEmitter = orderData.emitter.toLowerCase() === address?.toLowerCase();
  const isCourier = orderData.courier.toLowerCase() === address?.toLowerCase();
  const isReceiver = orderData.receiver.toLowerCase() === address?.toLowerCase();

  const role = isEmitter ? "Emisor" : isCourier ? "Mensajero" : isReceiver ? "Receptor" : "Participante";

  // Handle pickup confirmation (emitter signs, courier submits)
  const handleSignPickup = async () => {
    if (!address) return;

    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const hourWindow = timestamp / BigInt(3600);

    const messageHash = keccak256(
      encodePacked(
        ["uint256", "string", "address", "uint256"],
        [orderId, "PICKUP", orderData.courier, hourWindow]
      )
    );

    try {
      const signature = await signMessageAsync({
        message: { raw: messageHash },
      });

      // In real app, this would be shared with courier via QR or P2P
      alert(`Firma generada! Comparte con el mensajero:\n${signature}`);
    } catch (error) {
      console.error("Error signing pickup:", error);
    }
  };

  // Handle dispute submission
  const handleDisputeSubmit = () => {
    if (disputeReason.trim()) {
      initiateDispute(orderId, disputeReason);
      setShowDisputeModal(false);
    }
  };

  // Handle delivery with ZK proof
  const handleDelivery = async () => {
    if (!deliverySecret.trim() || !address) return;

    setIsGeneratingProof(true);
    setProofError(null);

    try {
      const secret = BigInt(deliverySecret.trim());
      const secretHash = bytes32ToBigint(orderData.secretHash);

      const { proof } = await generateDeliveryProof(
        secret,
        secretHash,
        BigInt(orderId),
        address
      );

      const { pA, pB, pC } = formatProofForContract(proof);
      confirmDelivery(orderId, pA, pB, pC);
    } catch (err) {
      console.error("Proof generation error:", err);
      setProofError(
        err instanceof Error ? err.message : "Error al generar la prueba ZK"
      );
    } finally {
      setIsGeneratingProof(false);
    }
  };

  // State-specific colors
  const stateColors: Record<OrderState, string> = {
    [OrderState.OPEN]: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    [OrderState.LOCKED]: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    [OrderState.PICKED_UP]: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    [OrderState.DELIVERED]: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    [OrderState.DISPUTED]: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    [OrderState.CANCELLED]: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    [OrderState.EXPIRED]: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <Link href="/orders" className="text-primary-500 hover:text-primary-600 mb-4 inline-block">
          &larr; Volver a Ordenes
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Orden #{orderId.toString()}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Tu rol: <span className="font-medium">{role}</span>
            </p>
          </div>
          <div className="text-right">
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${stateColors[state]}`} data-testid="order-status">
              {ORDER_STATE_LABELS[state]}
            </span>
            {timeRemaining && state !== OrderState.DELIVERED && state !== OrderState.CANCELLED && (
              <p className="text-sm text-gray-500 mt-2">
                Tiempo restante: <span className="font-medium">{timeRemaining}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Order Details */}
      <div className="grid md:grid-cols-2 gap-8" data-testid="order-details">
        {/* Main Info */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Detalles de la Orden
            </h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Valor del Paquete</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {formatUSDC(orderData.packageValue)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Fee de Entrega</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {formatUSDC(orderData.deliveryFee)}
                </dd>
              </div>
              {orderData.courierCollateral > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Colateral</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {formatUSDC(orderData.courierCollateral)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Participants */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Participantes
            </h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-gray-500 dark:text-gray-400 text-sm">Emisor</dt>
                <dd className="font-mono text-sm text-gray-900 dark:text-white truncate">
                  {orderData.emitter}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400 text-sm">Receptor</dt>
                <dd className="font-mono text-sm text-gray-900 dark:text-white truncate">
                  {orderData.receiver}
                </dd>
              </div>
              {orderData.courier !== "0x0000000000000000000000000000000000000000" && (
                <div>
                  <dt className="text-gray-500 dark:text-gray-400 text-sm">Mensajero</dt>
                  <dd className="font-mono text-sm text-gray-900 dark:text-white truncate">
                    {orderData.courier}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Actions Panel */}
        <div className="space-y-6">
          {/* QR Code for Receiver */}
          {isReceiver && (state === OrderState.LOCKED || state === OrderState.PICKED_UP) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                QR de Entrega
              </h2>
              {!receiverSecret ? (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Introduce el secreto que te dio el emisor para generar el QR de entrega.
                  </p>
                  <input
                    type="text"
                    placeholder="Pega el secreto aqui..."
                    value={receiverSecret}
                    onChange={(e) => setReceiverSecret(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-3 text-sm"
                  />
                  <button
                    onClick={() => {}} // State change triggers re-render
                    disabled={!receiverSecret.trim()}
                    className="w-full py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium disabled:opacity-50"
                  >
                    Generar QR
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Muestra este codigo al mensajero para confirmar la entrega
                  </p>
                  <div className="flex justify-center bg-white p-4 rounded-lg" data-testid="delivery-qr-code">
                    <QRCodeSVG
                      value={secretToQRData(
                        BigInt(receiverSecret),
                        orderId.toString(),
                        orderData.receiver
                      )}
                      size={200}
                      level="M"
                    />
                  </div>
                  <button
                    onClick={() => setReceiverSecret("")}
                    className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cambiar secreto
                  </button>
                </>
              )}
            </div>
          )}

          {/* Emitter: Sign Pickup */}
          {isEmitter && state === OrderState.LOCKED && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Confirmar Recogida
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Cuando el mensajero llegue a recoger, firma para confirmar que entregaste el paquete.
              </p>
              <button
                onClick={handleSignPickup}
                className="w-full py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium"
              >
                Firmar Confirmacion de Recogida
              </button>
            </div>
          )}

          {/* Courier: Confirm Delivery with ZK Proof */}
          {isCourier && state === OrderState.PICKED_UP && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Confirmar Entrega
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Escanea el QR del receptor o introduce el secreto para generar la prueba ZK y confirmar la entrega.
              </p>
              <input
                type="text"
                placeholder="Introduce el secreto del QR..."
                value={deliverySecret}
                onChange={(e) => setDeliverySecret(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-3 text-sm"
              />
              {proofError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-3 text-sm text-red-700 dark:text-red-400">
                  {proofError}
                </div>
              )}
              <button
                onClick={handleDelivery}
                disabled={!deliverySecret.trim() || isGeneratingProof || isPendingDelivery}
                className="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium disabled:opacity-50"
              >
                {isGeneratingProof
                  ? "Generando prueba ZK..."
                  : isPendingDelivery
                  ? "Enviando transaccion..."
                  : "Confirmar Entrega"}
              </button>
            </div>
          )}

          {/* Emitter: Cancel Order (only if OPEN) */}
          {isEmitter && state === OrderState.OPEN && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Cancelar Orden
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Puedes cancelar la orden mientras no haya sido aceptada por un mensajero.
              </p>
              <button
                onClick={() => cancelOrder(orderId)}
                disabled={isPendingCancel}
                className="w-full py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium disabled:opacity-50"
              >
                {isPendingCancel ? "Cancelando..." : "Cancelar Orden"}
              </button>
            </div>
          )}

          {/* Emitter: Claim Expired Order */}
          {isEmitter && state === OrderState.OPEN && timeRemaining === "Expirado" && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Orden Expirada
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                La orden ha expirado. Puedes reclamar tus fondos.
              </p>
              <button
                onClick={() => claimExpiredOrder(orderId)}
                disabled={isPendingClaim}
                className="w-full py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium disabled:opacity-50"
              >
                {isPendingClaim ? "Reclamando..." : "Reclamar Fondos"}
              </button>
            </div>
          )}

          {/* Dispute Button */}
          {(isEmitter || isCourier) && (state === OrderState.LOCKED || state === OrderState.PICKED_UP) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Reportar Problema
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Si hay un problema con la orden, puedes iniciar una disputa.
              </p>
              <button
                onClick={() => setShowDisputeModal(true)}
                className="w-full py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium"
                data-testid="dispute-btn"
              >
                Iniciar Disputa
              </button>
            </div>
          )}

          {/* Order Timeline */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Timeline
            </h2>
            <div className="space-y-4">
              <TimelineItem
                label="Creada"
                timestamp={orderData.createdAt}
                isComplete={true}
              />
              <TimelineItem
                label="Aceptada"
                timestamp={orderData.lockedAt}
                isComplete={orderData.lockedAt > 0}
              />
              <TimelineItem
                label="Recogida"
                timestamp={orderData.pickedUpAt}
                isComplete={orderData.pickedUpAt > 0}
              />
              <TimelineItem
                label="Entregada"
                timestamp={state === OrderState.DELIVERED ? BigInt(Date.now() / 1000) : BigInt(0)}
                isComplete={state === OrderState.DELIVERED}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Iniciar Disputa
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Describe el problema con la orden. Un administrador revisara tu caso.
            </p>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Describe el problema..."
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
              rows={4}
              data-testid="dispute-reason"
            />
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDisputeModal(false)}
                className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleDisputeSubmit}
                disabled={isPendingDispute || !disputeReason.trim()}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {isPendingDispute ? "Enviando..." : "Enviar Disputa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineItem({
  label,
  timestamp,
  isComplete,
}: {
  label: string;
  timestamp: bigint;
  isComplete: boolean;
}) {
  const formatDate = (ts: bigint) => {
    if (ts === BigInt(0)) return "-";
    return new Date(Number(ts) * 1000).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  return (
    <div className="flex items-center space-x-3">
      <div
        className={`w-3 h-3 rounded-full ${
          isComplete ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
        }`}
      />
      <div className="flex-1">
        <p className={`font-medium ${isComplete ? "text-gray-900 dark:text-white" : "text-gray-400"}`}>
          {label}
        </p>
        {isComplete && timestamp > BigInt(0) && (
          <p className="text-xs text-gray-500">{formatDate(timestamp)}</p>
        )}
      </div>
    </div>
  );
}
