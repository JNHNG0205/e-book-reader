import '@testing-library/jest-dom'

// jsdom implements neither of these; the continuous PDF viewer uses both.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
}
globalThis.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver
Element.prototype.scrollIntoView = () => {}
