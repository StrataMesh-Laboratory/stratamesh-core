def handle_messaging(p: Proposal, mem: Dict) -> str:
  if p.intent == "empty":
    return "empty action"
  return no_empty_action(p, mem)