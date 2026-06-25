/**
 * Teams bot connector for expense approvals: Adaptive Card / email builders,
 * proactive 1:1 messaging, and messaging-endpoint authentication.
 */

export {
  authenticateBotRequest,
  sendProactiveCard,
} from "./bot";
export {
  type ApprovalCardData,
  buildApprovalCard,
  buildApprovalEmailHtml,
  buildDecisionResultCard,
} from "./cards";
export {
  ensureBotChatForUser,
  sendApprovalEmail,
} from "./graph";
