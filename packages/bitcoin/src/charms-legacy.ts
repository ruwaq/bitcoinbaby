/**
 * Charms Protocol Integration
 *
 * Charms permite crear tokens programables sobre Bitcoin usando Spells.
 * https://charms.dev/
 */

export interface CharmSpell {
  name: string;
  version: string;
  operations: SpellOperation[];
}

interface SpellOperation {
  type: "mint" | "transfer" | "burn";
  token: string;
  amount: string | number;
  recipient?: string;
  proof?: string;
}

/**
 * @deprecated Use CharmsClient from './charms/client' instead
 */
export interface CharmsConfig {
  apiUrl: string;
  network: "mainnet" | "testnet4";
}

const defaultConfig: CharmsConfig = {
  apiUrl: "https://api.charms.dev",
  network: "testnet4",
};

/**
 * Cliente para interactuar con Charms Protocol
 */
export class CharmsClient {
  private config: CharmsConfig;

  constructor(config: Partial<CharmsConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Crea un Spell de mining para BABY tokens
   */
  createMineSpell(
    minerAddress: string,
    workProof: string,
    amount: number,
  ): CharmSpell {
    return {
      name: "mine-baby",
      version: "1.0.0",
      operations: [
        {
          type: "mint",
          token: "BABY",
          amount,
          recipient: minerAddress,
          proof: workProof,
        },
      ],
    };
  }

  /**
   * Envia un Spell a la red
   */
  async submitSpell(spell: CharmSpell): Promise<string> {
    const response = await fetch(`${this.config.apiUrl}/v1/spells`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(spell),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit spell: ${response.statusText}`);
    }

    const result = await response.json();
    return result.txid;
  }

  /**
   * Obtiene el estado de un Spell
   */
  async getSpellStatus(
    txid: string,
  ): Promise<"pending" | "confirmed" | "failed"> {
    const response = await fetch(`${this.config.apiUrl}/v1/spells/${txid}`);

    if (!response.ok) {
      throw new Error(`Failed to get spell status: ${response.statusText}`);
    }

    const result = await response.json();
    return result.status;
  }
}
