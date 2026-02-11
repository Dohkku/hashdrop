/**
 * E2E Test Setup and Utilities for HashDrop
 *
 * This file provides helper functions for testing the HashDrop application
 * with mock wallet connections and contract interactions.
 */

import { test as base, expect, Page } from "@playwright/test";

// Test wallet addresses (Anvil default accounts)
export const TEST_ACCOUNTS = {
  emitter: {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const,
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  },
  courier: {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const,
    privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  },
  receiver: {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as const,
    privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  },
};

// Contract addresses on local testnet
export const LOCAL_CONTRACTS = {
  escrow: "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const,
  reputation: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as const,
  usdc: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" as const,
};

/**
 * Extended test fixture with wallet mock helpers
 */
export const test = base.extend<{
  mockWallet: (address: string) => Promise<void>;
}>({
  mockWallet: async ({ page }, use) => {
    const mockWallet = async (address: string) => {
      // Inject mock wallet provider
      await page.addInitScript(
        (walletAddress) => {
          // Mock window.ethereum
          (window as any).ethereum = {
            isMetaMask: true,
            chainId: "0x7A69", // Local testnet chain ID (31337)
            selectedAddress: walletAddress,
            networkVersion: "31337",

            request: async ({ method, params }: { method: string; params?: any[] }) => {
              switch (method) {
                case "eth_requestAccounts":
                case "eth_accounts":
                  return [walletAddress];
                case "eth_chainId":
                  return "0x7A69";
                case "wallet_switchEthereumChain":
                  return null;
                case "eth_getBalance":
                  return "0x1000000000000000000"; // 1 ETH
                case "personal_sign":
                  // Return a mock signature
                  return "0x" + "00".repeat(65);
                default:
                  console.log("Unhandled eth method:", method);
                  return null;
              }
            },

            on: (event: string, callback: Function) => {
              // Store callbacks for later use
              if (event === "accountsChanged") {
                (window as any).__accountsChangedCallback = callback;
              }
              if (event === "chainChanged") {
                (window as any).__chainChangedCallback = callback;
              }
            },

            removeListener: () => {},
          };
        },
        address
      );
    };

    await use(mockWallet);
  },
});

export { expect };

/**
 * Wait for wallet connection to complete
 */
export async function waitForWalletConnected(page: Page) {
  // Wait for the connect button to disappear or change state
  await page.waitForSelector('[data-testid="wallet-connected"]', {
    timeout: 10000,
  });
}

/**
 * Connect wallet using the UI
 */
export async function connectWallet(page: Page) {
  const connectButton = page.locator('button:has-text("Conectar")');
  if (await connectButton.isVisible()) {
    await connectButton.click();
    await page.waitForTimeout(1000);
  }
}

/**
 * Fill the create order form
 */
export async function fillCreateOrderForm(
  page: Page,
  params: {
    receiverAddress: string;
    packageValue: string;
    deliveryFee: string;
    pickupAddress?: string;
    deliveryAddress?: string;
    description?: string;
  }
) {
  await page.fill('[data-testid="receiver-input"]', params.receiverAddress);
  await page.fill('[data-testid="package-value-input"]', params.packageValue);
  await page.fill('[data-testid="delivery-fee-input"]', params.deliveryFee);

  if (params.pickupAddress) {
    await page.fill('[data-testid="pickup-address-input"]', params.pickupAddress);
  }
  if (params.deliveryAddress) {
    await page.fill('[data-testid="delivery-address-input"]', params.deliveryAddress);
  }
  if (params.description) {
    await page.fill('[data-testid="description-input"]', params.description);
  }
}

/**
 * Parse USDC amount from display string
 */
export function parseDisplayedUSDC(text: string): number {
  // Remove currency symbols and formatting
  const cleaned = text.replace(/[^0-9.,]/g, "").replace(",", ".");
  return parseFloat(cleaned);
}

/**
 * Format USDC for input
 */
export function formatUSDCInput(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Generate test data for order creation
 */
export function generateTestOrderData() {
  return {
    receiverAddress: TEST_ACCOUNTS.receiver.address,
    packageValue: "50.00",
    deliveryFee: "10.00",
    pickupAddress: "Calle Test 123, Madrid",
    deliveryAddress: "Avenida Prueba 456, Madrid",
    description: "Test package for E2E testing",
  };
}

/**
 * Wait for transaction confirmation toast/notification
 */
export async function waitForTransactionConfirmation(page: Page) {
  await page.waitForSelector('[data-testid="tx-success"]', {
    timeout: 30000,
  });
}

/**
 * Check if element is visible with retry
 */
export async function isElementVisibleWithRetry(
  page: Page,
  selector: string,
  retries = 3,
  delay = 1000
): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const element = page.locator(selector);
      if (await element.isVisible()) {
        return true;
      }
    } catch {
      // Element not found
    }
    await page.waitForTimeout(delay);
  }
  return false;
}
