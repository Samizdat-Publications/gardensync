// Whether the assistant panel is open, and the panel itself, loaded the first time it opens so the
// rest of the app does not carry its code.
import { signal } from '@preact/signals';
import type { FunctionComponent } from 'preact';

export const assistantOpen = signal(false);
export const AssistantComponent = signal<FunctionComponent | null>(null);

export function openAssistant(): void {
  assistantOpen.value = true;
  if (!AssistantComponent.value) {
    void import('./AssistantPanel').then((m) => {
      AssistantComponent.value = m.AssistantPanel;
    });
  }
}
