"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import Link from "next/link";
import { QRScanner } from "@/components/QRScanner";
import { parseQRData } from "@/lib/zk";
import { useOrder, useConfirmDelivery, OrderState, ORDER_STATE_LABELS, formatUSDC } from "@/hooks/useEscrow";

function ConfirmDeliveryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const orderIdParam = searchParams.get("orderId");
  const orderId = orderIdParam ? BigInt(orderIdParam) : undefined;

  const { data: order, isLoading: orderLoading } = useOrder(orderId);
  const { confirmDelivery, isPending, isConfirming, isSuccess, error } = useConfirmDelivery();

  const [scannedData, setScannedData] = useState<{
    secret: bigint;
    orderId: string;
    receiverAddress: string;
  } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualSecret, setManualSecret] = useState("");

  // Redirect on success
  useEffect(() => {
    if (isSuccess && orderId) {
      setTimeout(() => {
        router.push(`/orders/${orderId}`);
      }, 2000);
    }
  }, [isSuccess, orderId, router]);

  const handleScan = (data: string) => {
    const parsed = parseQRData(data);
    if (!parsed) {
      setScanError("Codigo QR invalido");
      return;
    }

    // Validate orderId matches
    if (orderId && parsed.orderId !== orderId.toString()) {
      setScanError(`Este QR es para la orden #${parsed.orderId}, no para la #${orderId}`);
      return;
    }

    setScannedData(parsed);
    setScanError(null);
  };

  const handleScanError = (error: string) => {
    setScanError(error);
  };

  const handleConfirm = () => {
    if (!orderId) return;

    const secret = scannedData?.secret?.toString() || manualSecret;
    if (!secret) {
      setScanError("Necesitas escanear el QR o ingresar el secreto");
      return;
    }

    confirmDelivery(orderId, secret);
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Conecta tu wallet para continuar</p>
      </div>
    );
  }

  if (!orderId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No se especifico una orden</p>
          <Link href="/deliver" className="text-primary-500 hover:text-primary-600">
            Ver trabajos disponibles
          </Link>
        </div>
      </div>
    );
  }

  if (orderLoading) {
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
  const isCourier = orderData.courier.toLowerCase() === address?.toLowerCase();

  // Validate state and role
  if (!isCourier) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-500 mb-4">No eres el mensajero de esta orden</p>
          <Link href="/orders" className="text-primary-500 hover:text-primary-600">
            Ver mis ordenes
          </Link>
        </div>
      </div>
    );
  }

  if (state !== OrderState.PICKED_UP) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-yellow-600 mb-2">
            Esta orden no esta lista para entrega
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Estado actual: {ORDER_STATE_LABELS[state]}
          </p>
          <Link
            href={`/orders/${orderId}`}
            className="text-primary-500 hover:text-primary-600"
          >
            Ver detalles de la orden
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-4">
            Entrega Confirmada
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Los fondos estan siendo liberados...
          </p>
          <p className="text-sm text-gray-500">
            Redirigiendo a la orden...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="mb-8">
        <Link
          href={`/orders/${orderId}`}
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          &larr; Volver a orden #{orderId.toString()}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-4">
          Confirmar Entrega
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Escanea el codigo QR del receptor
        </p>
      </div>

      {/* Order summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Orden:</span>
          <span className="font-medium">#{orderId.toString()}</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-gray-500">Fee a recibir:</span>
          <span className="font-medium text-green-600">{formatUSDC(orderData.deliveryFee)}</span>
        </div>
      </div>

      {/* QR Scanner or scanned result */}
      {!scannedData ? (
        <div className="mb-6">
          <QRScanner onScan={handleScan} onError={handleScanError} />

          {/* Manual input fallback */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 mb-3 text-center">
              Problemas con la camara? Ingresa el secreto manualmente:
            </p>
            <input
              type="text"
              placeholder="Secreto del receptor..."
              value={manualSecret}
              onChange={(e) => setManualSecret(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>
        </div>
      ) : (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2 text-green-700 dark:text-green-400 mb-2">
            <span className="text-xl">✓</span>
            <span className="font-medium">QR Escaneado</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Orden: #{scannedData.orderId}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Secreto: {scannedData.secret.toString().slice(0, 20)}...
          </p>
          <button
            onClick={() => setScannedData(null)}
            className="text-sm text-primary-500 hover:text-primary-600 mt-2"
          >
            Escanear otro
          </button>
        </div>
      )}

      {/* Errors */}
      {(scanError || error) && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 text-red-700 dark:text-red-400 text-sm">
          {scanError || error?.message}
        </div>
      )}

      {/* Confirm button */}
      <button
        onClick={handleConfirm}
        disabled={isPending || isConfirming || (!scannedData && !manualSecret)}
        className="w-full py-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending
          ? "Firmando transaccion..."
          : isConfirming
          ? "Confirmando en blockchain..."
          : "Confirmar Entrega"}
      </button>

      <p className="text-xs text-gray-500 text-center mt-4">
        Al confirmar, los fondos seran liberados automaticamente
      </p>
    </div>
  );
}

export default function ConfirmDeliveryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      }
    >
      <ConfirmDeliveryContent />
    </Suspense>
  );
}
