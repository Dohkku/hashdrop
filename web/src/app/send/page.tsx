"use client";

import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { useRouter } from "next/navigation";
import { keccak256, encodePacked, toHex } from "viem";
import { useCreateOrder, parseUSDC, formatUSDC } from "@/hooks/useEscrow";
import { generateDeliverySecret, secretToQRData } from "@/lib/zk";

export default function SendPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const router = useRouter();
  const { createOrder, isPending, isConfirming, isSuccess, error } = useCreateOrder();

  const [form, setForm] = useState({
    receiverAddress: "",
    packageValue: "",
    deliveryFee: "",
    pickupAddress: "",
    deliveryAddress: "",
    packageDescription: "",
  });

  const [generatedSecret, setGeneratedSecret] = useState<{
    secret: bigint;
    secretHash: bigint;
    qrData: string;
  } | null>(null);

  const [step, setStep] = useState<"form" | "confirm" | "success">("form");

  // Calculate fees
  const packageValue = form.packageValue ? parseUSDC(form.packageValue) : 0n;
  const deliveryFee = form.deliveryFee ? parseUSDC(form.deliveryFee) : 0n;
  const protocolFee = (packageValue * 100n) / 10000n; // 1%
  const insuranceFee = (packageValue * 50n) / 10000n; // 0.5%
  const totalDeposit = packageValue + deliveryFee + protocolFee + insuranceFee;

  const handleGenerateSecret = async () => {
    const { secret, secretHash } = await generateDeliverySecret();
    const qrData = secretToQRData(secret, "pending", form.receiverAddress);
    setGeneratedSecret({ secret, secretHash, qrData });
    setStep("confirm");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!generatedSecret || !address) return;

    // Create zone hash from pickup address (simplified)
    const zoneHash = keccak256(encodePacked(["string"], [form.pickupAddress]));

    // Encrypt details and upload to IPFS (simplified - just use base64 for now)
    const details = {
      pickupAddress: form.pickupAddress,
      deliveryAddress: form.deliveryAddress,
      description: form.packageDescription,
    };
    const encryptedDetailsCID = btoa(JSON.stringify(details));

    // Convert secretHash to bytes32
    const secretHashBytes = toHex(generatedSecret.secretHash, { size: 32 });

    createOrder({
      receiver: form.receiverAddress as `0x${string}`,
      packageValue,
      deliveryFee,
      secretHash: secretHashBytes,
      deliveryZoneHash: zoneHash,
      encryptedDetailsCID,
    });
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Conecta tu wallet para continuar</p>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-4">
            Orden Creada
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Tu orden ha sido creada. Guarda el codigo QR para darselo al receptor.
          </p>

          {generatedSecret && (
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg mb-6">
              <p className="text-sm text-gray-500 mb-2">Codigo secreto (guardar):</p>
              <code className="text-xs break-all block p-2 bg-gray-100 dark:bg-gray-900 rounded">
                {generatedSecret.secret.toString()}
              </code>
            </div>
          )}

          <button
            onClick={() => router.push("/orders")}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            Ver Mis Ordenes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
        Crear Envio
      </h1>

      {step === "form" && (
        <form onSubmit={(e) => { e.preventDefault(); handleGenerateSecret(); }} className="space-y-6">
          {/* Receiver */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Direccion del Receptor (wallet)
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={form.receiverAddress}
              onChange={(e) => setForm({ ...form, receiverAddress: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          {/* Values */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Valor del Paquete (USDC)
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                placeholder="50.00"
                value={form.packageValue}
                onChange={(e) => setForm({ ...form, packageValue: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fee Mensajero (USDC)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                placeholder="10.00"
                value={form.deliveryFee}
                onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Addresses */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Direccion de Recogida
            </label>
            <input
              type="text"
              placeholder="Calle, numero, ciudad..."
              value={form.pickupAddress}
              onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Direccion de Entrega
            </label>
            <input
              type="text"
              placeholder="Calle, numero, ciudad..."
              value={form.deliveryAddress}
              onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descripcion del Paquete
            </label>
            <textarea
              placeholder="Describe el contenido..."
              value={form.packageDescription}
              onChange={(e) => setForm({ ...form, packageDescription: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Cost Summary */}
          {packageValue > 0n && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">
                Resumen de Costos
              </h3>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex justify-between">
                  <span>Valor asegurado:</span>
                  <span>{formatUSDC(packageValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fee mensajero:</span>
                  <span>{formatUSDC(deliveryFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fee protocolo (1%):</span>
                  <span>{formatUSDC(protocolFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fee seguro (0.5%):</span>
                  <span>{formatUSDC(insuranceFee)}</span>
                </div>
                <hr className="my-2 border-yellow-300 dark:border-yellow-700" />
                <div className="flex justify-between font-semibold text-gray-900 dark:text-white">
                  <span>Total a depositar:</span>
                  <span>{formatUSDC(totalDeposit)}</span>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors"
          >
            Continuar
          </button>
        </form>
      )}

      {step === "confirm" && generatedSecret && (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">
              Secreto Generado
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Este secreto se usara para confirmar la entrega. Guardalo en un lugar seguro
              y compartelo SOLO con el receptor.
            </p>
            <code className="text-xs break-all block p-2 bg-white dark:bg-gray-800 rounded">
              {generatedSecret.secret.toString().slice(0, 20)}...
            </code>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Resumen de la Orden</h3>
            <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
              <li>Receptor: {form.receiverAddress.slice(0, 10)}...</li>
              <li>Valor: {formatUSDC(packageValue)}</li>
              <li>Fee: {formatUSDC(deliveryFee)}</li>
              <li>Total: {formatUSDC(totalDeposit)}</li>
            </ul>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
              Error: {error.message}
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => setStep("form")}
              className="flex-1 py-3 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Volver
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending || isConfirming}
              className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {isPending
                ? "Firmando..."
                : isConfirming
                ? "Confirmando..."
                : "Crear Orden"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
