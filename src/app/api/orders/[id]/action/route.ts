import { apiUser, json, unauthorized } from "@/lib/api";
import { mutate } from "@/lib/db";
import * as wf from "@/lib/workflow";

export async function POST(req: Request, ctx: RouteContext<"/api/orders/[id]/action">) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const b = await req.json();
  const result = await mutate((db): wf.Result => {
    switch (b.action) {
      case "approve":
        return wf.approveOrder(db, user, id);
      case "reject":
        return wf.rejectOrder(db, user, id, b.reason);
      case "request_issue":
        return wf.requestIssue(db, user, id, b.items);
      case "approve_issue":
        return wf.decideIssue(db, user, id, b.issueId, true);
      case "reject_issue":
        return wf.decideIssue(db, user, id, b.issueId, false);
      case "issue":
        return wf.issueMaterial(db, user, id, b.issueId);
      case "start":
        return wf.startProduction(db, user, id);
      case "finish":
        return wf.finishProduction(db, user, id);
      case "receive_fg":
        return wf.receiveFG(db, user, id, Number(b.pieces));
      case "deliver":
        return wf.deliver(db, user, id);
      case "pay":
        return wf.receivePayment(db, user, id);
      default:
        return { ok: false, errors: ["err.generic"] };
    }
  });
  return json(result);
}
