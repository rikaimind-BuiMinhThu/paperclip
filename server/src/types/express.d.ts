export {};

import type { AgentApiKeyScope } from "@paperclipai/shared";

declare global {
  namespace Express {
    interface Request {
      actor: {
        type: "board" | "agent" | "api_customer" | "none";
        userId?: string;
        userName?: string | null;
        userEmail?: string | null;
        agentId?: string;
        companyId?: string;
        companyIds?: string[];
        apiAppId?: string;
        apiAppCustomerId?: string;
        planId?: string;
        sessionId?: string | null;
        memberships?: Array<{
          companyId: string;
          membershipRole?: string | null;
          status?: string;
        }>;
        onBehalfOfMemberships?: Array<{
          companyId: string;
          membershipRole?: string | null;
          status?: string;
        }>;
        isInstanceAdmin?: boolean;
        keyId?: string;
        keyScope?: AgentApiKeyScope;
        runId?: string;
        onBehalfOfUserId?: string | null;
        identityContextId?: string | null;
        source?:
          | "local_implicit"
          | "session"
          | "board_key"
          | "agent_key"
          | "agent_jwt"
          | "api_app_customer_key"
          | "cloud_tenant"
          | "cloud_control"
          | "none";
      };
    }
  }
}
