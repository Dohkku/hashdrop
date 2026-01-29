"use client";

import { useAccount } from "wagmi";
import Link from "next/link";
import { useUserOrders, useOrder, OrderState, ORDER_STATE_LABELS, formatUSDC } from "@/hooks/useEscrow";

export default function OrdersPage() {
  const { address, isConnected } = useAccount();
  const { data: orderIds, isLoading } = useUserOrders(address);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Conecta tu wallet para ver tus ordenes</p>
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

  const orders = orderIds as bigint[] | undefined;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Mis Ordenes
        </h1>
        <Link
          href="/send"
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
        >
          + Nueva Orden
        </Link>
      </div>

      {!orders || orders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No tienes ordenes aun
          </p>
          <Link
            href="/send"
            className="text-primary-500 hover:text-primary-600 font-medium"
          >
            Crear tu primera orden
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((orderId) => (
            <OrderCard key={orderId.toString()} orderId={orderId} userAddress={address!} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ orderId, userAddress }: { orderId: bigint; userAddress: `0x${string}` }) {
  const { data: order, isLoading } = useOrder(orderId);

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
  const isEmitter = orderData.emitter.toLowerCase() === userAddress.toLowerCase();
  const isCourier = orderData.courier.toLowerCase() === userAddress.toLowerCase();
  const isReceiver = orderData.receiver.toLowerCase() === userAddress.toLowerCase();

  const role = isEmitter ? "Emisor" : isCourier ? "Mensajero" : isReceiver ? "Receptor" : "Participante";

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
    <Link
      href={`/orders/${orderId}`}
      className="block p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-500 transition-colors"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Orden #{orderId.toString()}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tu rol: {role}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${stateColors[state]}`}>
          {ORDER_STATE_LABELS[state]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Valor:</span>
          <span className="ml-2 text-gray-900 dark:text-white font-medium">
            {formatUSDC(orderData.packageValue)}
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Fee:</span>
          <span className="ml-2 text-gray-900 dark:text-white font-medium">
            {formatUSDC(orderData.deliveryFee)}
          </span>
        </div>
      </div>
    </Link>
  );
}
