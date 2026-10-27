import { beforeEach } from 'vitest';
import { AdmissionWindow, processAdmission } from '../../backend/src/security/admission.js';
import { ProviderCapacity, processCapacity } from '../../backend/src/security/capacity.js';

// Each test represents a fresh process. Within a test all sessions share these objects;
// production game creation / usage reset never replace them.
beforeEach(() => {
  processAdmission.current = new AdmissionWindow();
  processCapacity.current = new ProviderCapacity();
});
