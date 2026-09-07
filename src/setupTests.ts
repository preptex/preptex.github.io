// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
import '@testing-library/jest-dom';
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  (global as unknown as { TextEncoder: typeof NodeTextEncoder }).TextEncoder = NodeTextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  (global as unknown as { TextDecoder: typeof NodeTextDecoder }).TextDecoder = NodeTextDecoder;
}
