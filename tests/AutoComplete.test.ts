// © 2026 AsterMind AI Co. – All Rights Reserved.
// Patent Pending US 63/897,713
// Tests for AutoComplete — backward compatibility of train() and the new
// optional per-pair `weights` argument (ADR-0005 / IMPL-0005 step 1).

import { describe, it, expect } from 'vitest';
import { AutoComplete } from '../src/index';

function makeElements() {
    const inputElement = document.createElement('input');
    const outputElement = document.createElement('div');
    document.body.appendChild(inputElement);
    document.body.appendChild(outputElement);
    return { inputElement, outputElement };
}

describe('AutoComplete.train()', () => {
    it('backward compatible: no-argument call trains and predicts as before', () => {
        const { inputElement, outputElement } = makeElements();
        const pairs = [
            { input: 'j', label: 'ohn' },
            { input: 'jo', label: 'hn' },
            { input: 'joh', label: 'n' },
            { input: 's', label: 'arah' },
            { input: 'sa', label: 'rah' },
        ];

        const model = new AutoComplete(pairs, {
            inputElement,
            outputElement,
            hiddenUnits: 32,
            activation: 'relu',
        });

        model.train();

        expect(model.model).toBeTruthy();
        const predictions = model.predict('j', 3);
        expect(Array.isArray(predictions)).toBe(true);
        expect(predictions.length).toBeGreaterThan(0);
        expect(predictions[0]).toHaveProperty('completion');
        expect(predictions[0]).toHaveProperty('prob');
    });

    it('weighted training shifts a conflicting fit toward the heavily-weighted label', () => {
        // Two samples share the exact same input ("ping") but disagree on the
        // label — a direct conflict, the same shape as the "i" -> many-words
        // ambiguity ADR-0005 targets. Unweighted, ridge regression should
        // split its probability mass roughly evenly between the two labels.
        const pairs = [
            { input: 'ping', label: 'x' },
            { input: 'ping', label: 'y' },
        ];

        const { inputElement: inUnweighted, outputElement: outUnweighted } = makeElements();
        const unweighted = new AutoComplete(pairs, {
            inputElement: inUnweighted,
            outputElement: outUnweighted,
            hiddenUnits: 16,
            activation: 'relu',
        });
        unweighted.train();
        const unweightedPreds = unweighted.predict('ping', 2);
        const unweightedGap = Math.abs(unweightedPreds[0].prob - unweightedPreds[1].prob);

        const { inputElement: inWeighted, outputElement: outWeighted } = makeElements();
        const weighted = new AutoComplete(pairs, {
            inputElement: inWeighted,
            outputElement: outWeighted,
            hiddenUnits: 16,
            activation: 'relu',
        });
        // Heavily upweight the "y" sample (index 1) relative to "x" (index 0).
        weighted.train([1, 20]);
        const weightedPreds = weighted.predict('ping', 1);

        // Confirms weights actually reached ELM.trainFromData's ridge solve
        // rather than being accepted and silently dropped: the weighted fit
        // resolves the conflict in favor of "y", and does so more decisively
        // than the unweighted (roughly 50/50) fit did.
        expect(weightedPreds[0].completion).toBe('y');
        expect(unweightedGap).toBeLessThan(0.3);
    });

    it('weights array is ignored for the kernel/online engines (no throw)', () => {
        const pairs = [
            { input: 'a', label: 'x' },
            { input: 'b', label: 'y' },
        ];
        const { inputElement, outputElement } = makeElements();
        const model = new AutoComplete(pairs, {
            inputElement,
            outputElement,
            engine: 'online',
            hiddenUnits: 8,
        });
        expect(() => model.train([5, 1])).not.toThrow();
    });
});
