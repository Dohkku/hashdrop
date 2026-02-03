"use client";

import { useParams, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  useOrder,
  useCancelOrder,
  useConfirmPickup,
  useConfirmDelivery,
  OrderState,
  ORDER_STATE_LABELS,
  formatUSDC,
} from "@/hooks/useEscrow";
import { QRGenerator } from "@/components/QRGenerator";

// Helper to decode encrypted details (base64 JSON)
function decodeDetails(encryptedDetailsCID: string): {
  pickupAddress?: string;
  deliveryAddress?: string;
  description?: string;
} {
  try {
    return JSON.parse(atob(encryptedDetailsCID));
  } catch {
    return {};
  }
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const orderId = BigInt(params.id as string);

  const { data: order, isLoading, refetch } = useOrder(orderId);
  const { cancelOrder, isPending: isCancelling, isSuccess: cancelSuccess } = useCancelOrder();
  const { confirmPickup, isPending: isPickingUp, isSuccess: pickupSuccess } = useConfirmPickup();
  const { confirmDelivery, isPending: isDelivering, isSuccess: deliverySuccess } = useConfirmDelivery();

  // Local storage for secret (only receiver should have this)
  const [savedSecret, setSavedSecret] = useState<bigint | null>(null);
  const [manualSecret, setManualSecret] = useState("");
  const [signatureInput, setSignatureInput] = useState("");

  // Load saved secret from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`order-secret-${orderId}`);
    if (stored) {
      setSavedSecret(BigInt(stored));
    }
  }, [orderId]);

  // Refetch on success
  useEffect(() => {
    if (cancelSuccess || pickupSuccess || deliverySuccess) {
      refetch();
    }
  }, [cancelSuccess, pickupSuccess, deliverySuccess, refetch]);

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
  const details = decodeDetails(orderData.encryptedDetailsCID);

  // Determine user role
  const isEmitter = orderData.emitter.toLowerCase() === address?.toLowerCase();
  const isCourier = orderData.courier.toLowerCase() === address?.toLowerCase();
  const isReceiver = orderData.receiver.toLowerCase() === address?.toLowerCase();
  const role = isEmitter ? "Emisor" : isCourier ? "Mensajero" : isReceiver ? "Receptor" : "Visitante";

  // State colors
  const stateColors: Record<OrderState, string> = {
    [OrderState.OPEN]: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    [OrderState.LOCKED]: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    [OrderState.PICKED_UP]: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    [OrderState.DELIVERED]: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    [OrderState.DISPUTED]: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    [OrderState.CANCELLED]: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    [OrderState.EXPIRED]: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

  const handleCancel = () => {
    cancelOrder(orderId);
  };

  const handleConfirmPickup = () => {
    if (!signatureInput) {
      alert("Ingresa la firma del emisor");
      return;
    }
    confirmPickup(orderId, signatureInput as `0x${string}`);
  };

  const handleManualDelivery = () => {
    if (!manualSecret) {
      alert("Ingresa el secreto");
      return;
    }
    confirmDelivery(orderId, manualSecret);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href="/orders"
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-2 inline-block"
          >
            &larr; Volver a ordenes
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Orden #{orderId.toString()}
          </h1>
        </div>
        <span className={`px-4 py-2 rounded-full text-sm font-medium ${stateColors[state]}`}>
          {ORDER_STATE_LABELS[state]}
        </span>
      </div>

      {/* Role Badge */}
      <div className="mb-6">
        <span className="text-sm text-gray-500 dark:text-gray-400">Tu rol: </span>
        <span className="text-sm font-medium text-gray-900 dark:text-white">{role}</span>
      </div>

      {/* Order Details Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Detalles de la Orden
        </h2>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Valor del paquete:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatUSDC(orderData.packageValue)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Fee mensajero:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatUSDC(orderData.deliveryFee)}
            </span>
          </div>
          {orderData.courierCollateral > BigInt(0) && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Colateral bloqueado:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatUSDC(orderData.courierCollateral)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Participants Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Participantes
        </h2>

        <div className="space-y-3 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400 block">Emisor:</span>
            <code className="text-xs break-all">{orderData.emitter}</code>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400 block">Receptor:</span>
            <code className="text-xs break-all">{orderData.receiver}</code>
          </div>
          {orderData.courier !== "0x0000000000000000000000000000000000000000" && (
            <div>
              <span className="text-gray-500 dark:text-gray-400 block">Mensajero:</span>
              <code className="text-xs break-all">{orderData.courier}</code>
            </div>
          )}
        </div>
      </div>

      {/* Delivery Details (visible to courier) */}
      {(isCourier || isEmitter) && details.pickupAddress && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Direcciones
          </h2>

          <div className="space-y-3 text-sm">
            {details.pickupAddress && (
              <div>
                <span className="text-gray-500 dark:text-gray-400 block">Recogida:</span>
                <span className="text-gray-900 dark:text-white">{details.pickupAddress}</span>
              </div>
            )}
            {details.deliveryAddress && (
              <div>
                <span className="text-gray-500 dark:text-gray-400 block">Entrega:</span>
                <span className="text-gray-900 dark:text-white">{details.deliveryAddress}</span>
              </div>
            )}
            {details.description && (
              <div>
                <span className="text-gray-500 dark:text-gray-400 block">Descripcion:</span>
                <span className="text-gray-900 dark:text-white">{details.description}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions based on state and role */}
      <div className="space-y-4">
        {/* OPEN state actions */}
        {state === OrderState.OPEN && isEmitter && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">
              Esperando Mensajero
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Tu orden esta abierta esperando que un mensajero la acepte.
            </p>
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isCancelling ? "Cancelando..." : "Cancelar Orden"}
            </button>
          </div>
        )}

        {/* LOCKED state - Emitter needs to sign for pickup */}
        {state === OrderState.LOCKED && isEmitter && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">
              Mensajero Asignado
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Un mensajero ha aceptado tu orden. Cuando recoja el paquete, firma la recogida.
            </p>
            <Link
              href={`/orders/${orderId}/sign-pickup`}
              className="inline-block px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              Firmar Recogida
            </Link>
          </div>
        )}

        {/* LOCKED state - Courier needs to confirm pickup with signature */}
        {state === OrderState.LOCKED && isCourier && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">
              Confirmar Recogida
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Pide al emisor que firme la recogida e ingresa la firma aqui.
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="0x... (firma del emisor)"
                value={signatureInput}
                onChange={(e) => setSignatureInput(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
              <button
                onClick={handleConfirmPickup}
                disabled={isPickingUp || !signatureInput}
                className="w-full px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isPickingUp ? "Confirmando..." : "Confirmar Recogida"}
              </button>
            </div>
          </div>
        )}

        {/* PICKED_UP state - Courier can scan QR */}
        {state === OrderState.PICKED_UP && isCourier && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6">
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">
              Entregar Paquete
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Cuando llegues con el receptor, escanea su codigo QR para confirmar la entrega.
            </p>
            <Link
              href={`/deliver/confirm?orderId=${orderId}`}
              className="inline-block px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              Escanear QR de Entrega
            </Link>

            {/* Manual secret input as fallback */}
            <div className="mt-4 pt-4 border-t border-orange-200 dark:border-orange-700">
              <p className="text-xs text-gray-500 mb-2">O ingresa el secreto manualmente:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Secreto..."
                  value={manualSecret}
                  onChange={(e) => setManualSecret(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                />
                <button
                  onClick={handleManualDelivery}
                  disabled={isDelivering || !manualSecret}
                  className="px-4 py-2 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50"
                >
                  {isDelivering ? "..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PICKED_UP state - Receiver shows QR */}
        {state === OrderState.PICKED_UP && isReceiver && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6">
            <h3 className="font-semibold mb-4 text-gray-900 dark:text-white text-center">
              Tu Codigo de Entrega
            </h3>

            {savedSecret ? (
              <QRGenerator
                secret={savedSecret}
                orderId={orderId.toString()}
                receiverAddress={address || ""}
                size={250}
                showSecret={true}
              />
            ) : (
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  No tienes el secreto guardado. Pidelo al emisor.
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Ingresa el secreto aqui..."
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                    onChange={(e) => {
                      try {
                        const secret = BigInt(e.target.value);
                        setSavedSecret(secret);
                        localStorage.setItem(`order-secret-${orderId}`, secret.toString());
                      } catch {
                        // Invalid input
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* DELIVERED state */}
        {state === OrderState.DELIVERED && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
            <div className="text-4xl mb-2">✅</div>
            <h3 className="font-semibold text-green-700 dark:text-green-400">
              Entrega Completada
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Los fondos han sido liberados automaticamente.
            </p>
          </div>
        )}

        {/* CANCELLED state */}
        {state === OrderState.CANCELLED && (
          <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">
              Orden Cancelada
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Los fondos han sido devueltos al emisor.
            </p>
          </div>
        )}

        {/* DISPUTED state */}
        {state === OrderState.DISPUTED && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <h3 className="font-semibold text-red-700 dark:text-red-400">
              En Disputa
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Esta orden esta siendo revisada por el equipo de HashDrop.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
