declare module "circomlibjs" {
  export interface PoseidonFunction {
    (inputs: bigint[]): Uint8Array;
    F: {
      toObject(element: Uint8Array): bigint;
    };
  }

  export function buildPoseidon(): Promise<PoseidonFunction>;
}
