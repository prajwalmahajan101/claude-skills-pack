# Unabridged — Before/After Examples

Concrete pairs showing the difference between a partial (broken) output and a complete (acceptable) one. Read this when you're unsure whether a particular shortcut is allowed.

---

## 1. Skeleton vs Full Implementation

**Request:** "Write a `Stack` class in Python with push, pop, peek, is_empty, and size."

### Bad (skeleton)

```python
class Stack:
    def __init__(self):
        # TODO: initialize storage
        pass

    def push(self, item):
        # TODO: implement
        pass

    def pop(self):
        # TODO: implement
        pass

    # ... etc
```

### Good (full)

```python
class Stack:
    def __init__(self):
        self._items: list = []

    def push(self, item) -> None:
        self._items.append(item)

    def pop(self):
        if not self._items:
            raise IndexError("pop from empty stack")
        return self._items.pop()

    def peek(self):
        if not self._items:
            raise IndexError("peek from empty stack")
        return self._items[-1]

    def is_empty(self) -> bool:
        return not self._items

    def size(self) -> int:
        return len(self._items)
```

Five methods asked for, five methods delivered with real bodies.

---

## 2. "Rest Follows the Same Pattern" vs Written Out

**Request:** "Give me React Button components for primary, secondary, danger, and ghost variants."

### Bad

```tsx
export function PrimaryButton(props) {
  return <button className="bg-blue-600 text-white px-4 py-2 rounded">{props.children}</button>;
}

// The remaining three (secondary, danger, ghost) follow the same pattern with different colors.
```

### Good

```tsx
export function PrimaryButton(props) {
  return <button className="bg-blue-600 text-white px-4 py-2 rounded">{props.children}</button>;
}

export function SecondaryButton(props) {
  return <button className="bg-slate-200 text-slate-900 px-4 py-2 rounded">{props.children}</button>;
}

export function DangerButton(props) {
  return <button className="bg-red-600 text-white px-4 py-2 rounded">{props.children}</button>;
}

export function GhostButton(props) {
  return <button className="bg-transparent text-slate-900 px-4 py-2 rounded hover:bg-slate-100">{props.children}</button>;
}
```

Four components asked for, four components written.

---

## 3. Continuation Marker — Done Right

**Request:** "Generate 10 e2e tests for the checkout flow." (Each test is ~80 lines; total exceeds the token budget.)

### Bad (compresses to finish in one turn)

```ts
test("happy path", async () => { /* placeholder */ });
test("invalid card", async () => { /* placeholder */ });
test("declined", async () => { /* placeholder */ });
// Tests 4 through 10 follow the same shape with different inputs.
```

### Good (clean pause at boundary, resumes without recap)

```ts
test("happy path", async () => {
  // full 80-line implementation
});

test("invalid card", async () => {
  // full 80-line implementation
});

test("declined", async () => {
  // full 80-line implementation
});

test("expired card", async () => {
  // full 80-line implementation
});
```

```
[PAUSED — 4 of 10 complete. Send "continue" to resume from: test 5 of 10: insufficient funds]
```

On `continue`:

```ts
test("insufficient funds", async () => {
  // full 80-line implementation, no recap, no re-emit of tests 1 through 4
});
```

---

## 4. Prose Hedging vs Direct Answer

**Request:** "Explain how a B-tree differs from a B+ tree."

### Bad

> B-trees and B+ trees are both self-balancing tree structures used in databases. The main differences are around where data is stored and how leaves are linked. For brevity I won't go into all the details, but let me know if you want me to continue.

### Good

> A B-tree stores keys and associated data in every node (internal and leaf). A B+ tree stores data only in leaf nodes; internal nodes hold keys for routing. B+ trees additionally link leaf nodes in a sorted singly- or doubly-linked list, which makes range scans O(log n + k) instead of O(k log n). Databases prefer B+ trees because (1) internal nodes hold more keys per page when they don't carry data, giving a shallower tree and fewer disk seeks per lookup; (2) linked leaves let `SELECT … WHERE x BETWEEN a AND b` walk the result set without re-descending.

Three concrete differences, the reason it matters, no hedging, no offer to continue.
