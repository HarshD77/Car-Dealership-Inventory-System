import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';

expect.extend(matchers);
afterEach(cleanup);

// jsdom does not implement the browser's modal dialog methods.
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
