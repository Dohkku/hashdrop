"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useNextOrderId, useOrder, useAcceptOrder, OrderState, ORDER_STATE_LABELS, formatUSDC } from "@/hooks/useEscrow";

export default function DeliverPage() {
  const { address, isConnected } = useAccount();
  const { data: nextOrderId } = useNextOrderId();
  const [selectedOrder, setSelectedOrder] = useState<bigint | null>(null);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Conecta tu wallet para ver trabajos disponibles</p>
      </div>
    );
  }

  // Get last 20 orders (simplified - in production use The Graph)
  const totalOrders = nextOrderId ? Number(nextOrderId) : 0;
  const recentOrderIds = Array.from(
    { length: Math.min(20, totalOrders) },
    (_, i) => BigInt(totalOrders - 1 - i)
  ).filter((id) => id >= BigInt(0));

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">
        Trabajos Disponibles
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        Acepta un trabajo para empezar a entregar. Necesitaras depositar colateral.
      </p>

      {recentOrderIds.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-gray-500 dark:text-gray-400">
            No hay trabajos disponibles en este momento
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {recentOrderIds.map((orderId) => (
            <AvailableOrderCard
              key={orderId.toString()}
              orderId={orderId}
              userAddress={address!}
              isSelected={selectedOrder === orderId}
              onSelect={() => setSelectedOrder(orderId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AvailableOrderCard({
  orderId,
  userAddress,
  isSelected,
  onSelect,
}: {
  orderId: bigint;
  userAddress: `0x${string}`;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { data: order, isLoading } = useOrder(orderId);
  const { acceptOrder, isPending, isConfirming, isSuccess, error } = useAcceptOrder();

  if (isLoading || !order) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      </div>
    );
  }

  const orderData = order as any;
  const state = orderData.state as OrderState;

  // Only show OPEN orders
  if (state !== OrderState.OPEN) {
    return null;
  }

  // Don't show orders where user is emitter or receiver
  if (
    orderData.emitter.toLowerCase() === userAddress.toLowerCase() ||
    orderData.receiver.toLowerCase() === userAddress.toLowerCase()
  ) {
    return null;
  }

  const collateralRequired = (orderData.packageValue * BigInt(110)) / BigInt(100);

  const handleAccept = () => {
    acceptOrder(orderId);
  };

  if (isSuccess) {
    return (
      <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
        <p className="text-green-700 dark:text-green-400 font-medium">
          Has aceptado la orden #{orderId.toString()}. Ve a "Mis Ordenes" para continuar.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`p-6 bg-white dark:bg-gray-800 rounded-xl border transition-colors cursor-pointer ${
        isSelected
          ? "border-primary-500 ring-2 ring-primary-500/20"
          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
      }`}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Orden #{orderId.toString()}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Creada por: {orderData.emitter.slice(0, 8)}...
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          Disponible
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm mb-4">
        <div>
          <span className="text-gray-500 dark:text-gray-400 block">Valor Paquete</span>
          <span className="text-gray-900 dark:text-white font-medium">
            {formatUSDC(orderData.packageValue)}
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400 block">Tu Fee</span>
          <span className="text-green-600 dark:text-green-400 font-medium">
            +{formatUSDC(orderData.deliveryFee)}
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400 block">Colateral</span>
          <span className="text-orange-600 dark:text-orange-400 font-medium">
            {formatUSDC(collateralRequired)}
          </span>
        </div>
      </div>

      {isSelected && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Al aceptar, depositaras <strong>{formatUSDC(collateralRequired)}</strong> como colateral.
              Lo recuperaras al completar la entrega.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4 text-red-700 dark:text-red-400 text-sm">
              Error: {error.message}
            </div>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAccept();
            }}
            disabled={isPending || isConfirming}
            className="w-full py-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {isPending
              ? "Firmando..."
              : isConfirming
              ? "Confirmando..."
              : "Aceptar Trabajo"}
          </button>
        </div>
      )}
    </div>
  );
}
