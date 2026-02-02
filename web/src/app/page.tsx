"use client";

import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          <span className="bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
            Delivery P2P
          </span>
          <br />
          <span className="text-gray-900 dark:text-white">Sin Intermediarios</span>
        </h1>

        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
          Envia y recibe paquetes de forma segura usando smart contracts.
          Sin comisiones abusivas. Sin confianza ciega. Solo matematicas.
        </p>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <FeatureCard
            title="Escrow Seguro"
            description="Fondos bloqueados hasta confirmar entrega. Colateral del 110% protege tu paquete."
            icon="🔐"
          />
          <FeatureCard
            title="Zero-Knowledge"
            description="Prueba la entrega sin revelar informacion sensible. Privacidad total."
            icon="🛡️"
          />
          <FeatureCard
            title="Fees Minimos"
            description="Solo 1% de fee vs 30% de apps tradicionales. Tu dinero, para ti."
            icon="💰"
          />
        </div>

        {/* CTA */}
        {!isConnected ? (
          <div className="flex flex-col items-center space-y-4">
            <p className="text-gray-500 dark:text-gray-400">
              Conecta tu wallet para empezar
            </p>
            <ConnectButton />
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/send"
              className="px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors w-full sm:w-auto"
            >
              Enviar Paquete
            </Link>
            <Link
              href="/deliver"
              className="px-8 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-lg transition-colors w-full sm:w-auto"
            >
              Ser Mensajero
            </Link>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="mt-24 max-w-4xl mx-auto w-full">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900 dark:text-white">
          Como Funciona
        </h2>

        <div className="grid md:grid-cols-4 gap-4">
          <StepCard
            number={1}
            title="Crea Orden"
            description="Deposita el valor + fee en el smart contract"
          />
          <StepCard
            number={2}
            title="Mensajero Acepta"
            description="Pone colateral del 110% como garantia"
          />
          <StepCard
            number={3}
            title="Entrega"
            description="Escanea QR del receptor para probar entrega"
          />
          <StepCard
            number={4}
            title="Fondos Liberados"
            description="Automaticamente al verificar la prueba ZK"
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm">{description}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="relative p-4 text-center">
      <div className="w-10 h-10 rounded-full bg-primary-500 text-white font-bold flex items-center justify-center mx-auto mb-3">
        {number}
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}
