"use client";

import { useAccount } from "wagmi";
import { useState } from "react";
import Link from "next/link";
import {
  useUserOrders,
  useOrder,
  OrderState,
  ORDER_STATE_LABELS,
  formatUSDC,
} from "@/hooks/useEscrow";

export default function DisputesPage() {
  const { address, isConnected } = useAccount();
  const { data: orderIds, isLoading } = useUserOrders(address);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Conecta tu wallet para ver tus disputas</p>
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Disputas
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Gestion de disputas para tus ordenes
        </p>
      </div>

      {/* Information Card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Como funcionan las disputas
        </h2>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li className="flex items-start">
            <span className="mr-2">1.</span>
            Solo puedes iniciar una disputa en ordenes con estado LOCKED o PICKED_UP
          </li>
          <li className="flex items-start">
            <span className="mr-2">2.</span>
            Un administrador revisara el caso y tomara una decision
          </li>
          <li className="flex items-start">
            <span className="mr-2">3.</span>
            La parte perdedora puede recibir penalizaciones en su reputacion
          </li>
          <li className="flex items-start">
            <span className="mr-2">4.</span>
            Los fondos se distribuyen segun la resolucion
          </li>
        </ul>
      </div>

      {/* Tabs */}
      <DisputeTabs orders={orders || []} userAddress={address!} />
    </div>
  );
}

function DisputeTabs({
  orders,
  userAddress,
}: {
  orders: bigint[];
  userAddress: `0x${string}`;
}) {
  const [activeTab, setActiveTab] = useState<"active" | "resolved" | "eligible">("active");

  return (
    <div>
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-4 py-2 border-b-2 font-medium text-sm ${
            activeTab === "active"
              ? "border-primary-500 text-primary-500"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Disputas Activas
        </button>
        <button
          onClick={() => setActiveTab("eligible")}
          className={`px-4 py-2 border-b-2 font-medium text-sm ${
            activeTab === "eligible"
              ? "border-primary-500 text-primary-500"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Elegibles para Disputa
        </button>
        <button
          onClick={() => setActiveTab("resolved")}
          className={`px-4 py-2 border-b-2 font-medium text-sm ${
            activeTab === "resolved"
              ? "border-primary-500 text-primary-500"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Resueltas
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="text-gray-500 dark:text-gray-400">
              No tienes ordenes
            </p>
          </div>
        ) : (
          orders.map((orderId) => (
            <DisputeOrderCard
              key={orderId.toString()}
              orderId={orderId}
              userAddress={userAddress}
              filter={activeTab}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DisputeOrderCard({
  orderId,
  userAddress,
  filter,
}: {
  orderId: bigint;
  userAddress: `0x${string}`;
  filter: "active" | "resolved" | "eligible";
}) {
  const { data: order, isLoading } = useOrder(orderId);

  if (isLoading || !order) {
    return null;
  }

  const orderData = order as any;
  const state = orderData.state as OrderState;

  // Filter based on tab
  if (filter === "active" && state !== OrderState.DISPUTED) {
    return null;
  }
  if (filter === "eligible" && state !== OrderState.LOCKED && state !== OrderState.PICKED_UP) {
    return null;
  }
  if (filter === "resolved") {
    // Show cancelled/delivered orders that might have been resolved from disputes
    // In real app, you'd track this differently
    return null;
  }

  const isEmitter = orderData.emitter.toLowerCase() === userAddress.toLowerCase();
  const isCourier = orderData.courier.toLowerCase() === userAddress.toLowerCase();
  const canDispute = (isEmitter || isCourier) && (state === OrderState.LOCKED || state === OrderState.PICKED_UP);

  const stateColors: Record<OrderState, string> = {
    [OrderState.OPEN]: "bg-blue-100 text-blue-800",
    [OrderState.LOCKED]: "bg-yellow-100 text-yellow-800",
    [OrderState.PICKED_UP]: "bg-orange-100 text-orange-800",
    [OrderState.DELIVERED]: "bg-green-100 text-green-800",
    [OrderState.DISPUTED]: "bg-red-100 text-red-800",
    [OrderState.CANCELLED]: "bg-gray-100 text-gray-800",
    [OrderState.EXPIRED]: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Orden #{orderId.toString()}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isEmitter ? "Eres el emisor" : isCourier ? "Eres el mensajero" : "Participante"}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${stateColors[state]}`}>
          {ORDER_STATE_LABELS[state]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
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

      {state === OrderState.DISPUTED && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-800 dark:text-red-200">
            Esta orden esta en disputa. Un administrador revisara el caso.
          </p>
        </div>
      )}

      <div className="flex space-x-3">
        <Link
          href={`/orders/${orderId}`}
          className="flex-1 py-2 text-center border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Ver Detalles
        </Link>
        {canDispute && (
          <Link
            href={`/orders/${orderId}#dispute`}
            className="flex-1 py-2 text-center bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Iniciar Disputa
          </Link>
        )}
      </div>
    </div>
  );
}
