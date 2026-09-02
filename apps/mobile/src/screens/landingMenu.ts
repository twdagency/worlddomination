export interface LandingAction {
  id: 'continue' | 'start' | 'tutorial' | 'options';
  label: string;
}

export function landingActions(hasSavedCampaign: boolean): LandingAction[] {
  const actions: LandingAction[] = [];
  if (hasSavedCampaign) {
    actions.push({ id: 'continue', label: 'Continue' });
  }
  actions.push(
    { id: 'start', label: 'Start Game' },
    { id: 'tutorial', label: 'Play Tutorial' },
    { id: 'options', label: 'Options' },
  );
  return actions;
}
