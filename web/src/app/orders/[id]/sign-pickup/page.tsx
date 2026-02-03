"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount, useWalletClient } from "wagmi";
import Link from "next/link";
import { useOrder, OrderState, ORDER_STATE_LABELS } from "@/hooks/useEscrow";
import { signPickupMessage, formatSignatureInfo } from "@/lib/signing";

export default function SignPickupPage() {
  const params = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const orderId = BigInt(params.id as string);
  const { data: order, isLoading } = useOrder(orderId);

  const [signature, setSignature] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Conecta tu wallet para continuar</p>
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
  const courierAddress = orderData.courier as `0x${string}`;

  // Validate state and role
  if (!isEmitter) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-500 mb-4">Solo el emisor puede firmar la recogida</p>
          <Link href={`/orders/${orderId}`} className="text-primary-500 hover:text-primary-600">
            Volver a la orden
          </Link>
        </div>
      </div>
    );
  }

  if (state !== OrderState.LOCKED) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-yellow-600 mb-2">
            Esta orden no necesita firma de recogida
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Estado actual: {ORDER_STATE_LABELS[state]}
          </p>
          <Link
            href={`/orders/${orderId}`}
            className="text-primary-500 hover:text-primary-600"
          >
            Volver a la orden
          </Link>
        </div>
      </div>
    );
  }

  const signatureInfo = formatSignatureInfo(orderId, courierAddress);

  const handleSign = async () => {
    if (!walletClient) {
      setError("Wallet no disponible");
      return;
    }

    setIsSigning(true);
    setError(null);

    try {
      const sig = await signPickupMessage(walletClient, orderId, courierAddress);
      setSignature(sig);
    } catch (err: any) {
      setError(err.message || "Error al firmar");
    } finally {
      setIsSigning(false);
    }
  };

  const handleCopy = async () => {
    if (signature) {
      await navigator.clipboard.writeText(signature);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
          Firmar Recogida
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Firma para confirmar que el mensajero ha recogido el paquete
        </p>
      </div>

      {/* Info card */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6">
        <h3 className="font-medium mb-3 text-gray-900 dark:text-white">
          Detalles de la firma
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Orden:</span>
            <span className="font-mono">#{signatureInfo.orderId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Mensajero:</span>
            <span className="font-mono text-xs">{signatureInfo.courier.slice(0, 10)}...</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Ventana horaria:</span>
            <span className="font-mono">{signatureInfo.hourWindow}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Expira en:</span>
            <span className="text-orange-600 font-medium">{signatureInfo.expiresIn}</span>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          <strong>Importante:</strong> Solo firma si el mensajero esta presente y ha recogido el paquete.
          Esta firma tiene validez durante la hora actual.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Sign button or signature result */}
      {!signature ? (
        <button
          onClick={handleSign}
          disabled={isSigning}
          className="w-full py-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {isSigning ? "Firmando..." : "Firmar Recogida"}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-green-700 dark:text-green-400 mb-3">
              <span className="text-xl">✓</span>
              <span className="font-medium">Firma generada</span>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded p-3 mb-3">
              <code className="text-xs break-all block">
                {signature}
              </code>
            </div>

            <button
              onClick={handleCopy}
              className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              {copied ? "Copiado!" : "Copiar Firma"}
            </button>
          </div>

          <p className="text-sm text-gray-500 text-center">
            Comparte esta firma con el mensajero para que pueda confirmar la recogida en la app.
          </p>

          <button
            onClick={() => setSignature(null)}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Generar nueva firma
          </button>
        </div>
      )}
    </div>
  );
}
