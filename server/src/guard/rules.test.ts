import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkAltText,
  checkDescription,
  checkMaterials,
  checkStyles,
  checkTags,
  checkTitle,
  checkVariationValue,
  type RuleError,
} from './rules.ts';

function show(errors: RuleError[]): string[] {
  return errors.map((e) => `${e.field}: ${e.reason}`);
}

describe('checkTitle', () => {
  const cases: Array<[string, string, string[]]> = [
    ['plain words and punctuation', 'Retro Sunset Tee, Beach Shirt - Summer Gift!', []],
    ['math symbols', 'Pi ≈ 3.14 Shirt ± Math ∞ Tee × 2', []],
    ['™ © ®', 'Sunset™ Tee © 2026 ®', []],
    ['each of % : & + once', '100% Cotton: Sun & Sea + Sand', []],
    ['exactly 140 characters', 'a'.repeat(140), []],
    ['141 characters', 'a'.repeat(141), ['title: is 141 characters; Etsy allows at most 140']],
    ['empty', '   ', ['title: is empty']],
    ['an emoji', 'Sunset Tee 🌅', ['title: contains characters Etsy does not allow: "🌅"']],
    ['a newline', 'Sunset\nTee', ['title: contains characters Etsy does not allow: "\\n"']],
    ['% twice', '50% off 100% fun', ['title: uses "%" 2 times; Etsy allows it at most once']],
    ['& and + twice each', 'Sun & Sea & Sand + Fun + Joy', [
      'title: uses "&" 2 times; Etsy allows it at most once',
      'title: uses "+" 2 times; Etsy allows it at most once',
    ]],
  ];
  for (const [name, title, expected] of cases) {
    it(name, () => assert.deepEqual(show(checkTitle(title)), expected));
  }

  it('counts characters, not UTF-16 units', () => {
    // '𝐀' (U+1D400) is a letter, one character but two UTF-16 units.
    assert.deepEqual(show(checkTitle('𝐀'.repeat(140))), []);
    assert.deepEqual(show(checkTitle('𝐀'.repeat(141))), ['title: is 141 characters; Etsy allows at most 140']);
  });
});

describe('checkTags', () => {
  const cases: Array<[string, string[], string[]]> = [
    ['letters, digits, space, hyphen, apostrophe, ™©®', ["mom's gift", 'retro-tee 2026', 'brand™'], []],
    ['exactly 20 characters', ['a'.repeat(20)], []],
    ['21 characters', ['a'.repeat(21)], ['tags[0]: is 21 characters; Etsy allows at most 20']],
    ['13 tags', Array.from({ length: 13 }, (_, i) => `tag ${i}`), []],
    ['14 tags', Array.from({ length: 14 }, (_, i) => `tag ${i}`), ['tags: has 14 tags; Etsy allows at most 13']],
    ['empty tag', ['ok', ' '], ['tags[1]: is empty']],
    ['comma and ampersand', ['sun, sea', 'a&b'], [
      'tags[0]: contains characters Etsy does not allow: ","',
      'tags[1]: contains characters Etsy does not allow: "&"',
    ]],
    ['no tags', [], []],
  ];
  for (const [name, tags, expected] of cases) {
    it(name, () => assert.deepEqual(show(checkTags(tags)), expected));
  }
});

describe('checkMaterials', () => {
  const cases: Array<[string, string[], string[]]> = [
    ['letters, digits, spaces', ['100 cotton', 'Ringspun Cotton'], []],
    ['accented letters', ['algodón'], []],
    ['hyphen and percent', ['tri-blend', '100%'], [
      'materials[0]: contains characters Etsy does not allow: "-"',
      'materials[1]: contains characters Etsy does not allow: "%"',
    ]],
    ['empty', [''], ['materials[0]: is empty']],
  ];
  for (const [name, materials, expected] of cases) {
    it(name, () => assert.deepEqual(show(checkMaterials(materials)), expected));
  }
});

describe('checkStyles', () => {
  const cases: Array<[string, string[], string[]]> = [
    ['two styles', ['Retro', 'Boho'], []],
    ['three styles', ['Retro', 'Boho', 'Minimal'], ['styles: has 3 styles; Etsy allows at most 2']],
    ['exactly 45 characters', ['a'.repeat(45)], []],
    ['46 characters', ['a'.repeat(46)], ['styles[0]: is 46 characters; Etsy allows at most 45']],
    ['punctuation', ['Mid-century'], ['styles[0]: contains characters Etsy does not allow: "-"']],
  ];
  for (const [name, styles, expected] of cases) {
    it(name, () => assert.deepEqual(show(checkStyles(styles)), expected));
  }
});

describe('checkAltText', () => {
  it('allows empty and 500 characters', () => {
    assert.deepEqual(show(checkAltText('')), []);
    assert.deepEqual(show(checkAltText('a'.repeat(500))), []);
  });
  it('rejects 501 characters and names the field', () => {
    assert.deepEqual(show(checkAltText('a'.repeat(501), 'images[2].altText')), [
      'images[2].altText: is 501 characters; Etsy allows at most 500',
    ]);
  });
});

describe('checkDescription', () => {
  it('requires some text', () => {
    assert.deepEqual(show(checkDescription('Soft tee.\n\nCare: wash cold.')), []);
    assert.deepEqual(show(checkDescription(' \n ', 'footer')), ['footer: is empty']);
  });
});

describe('checkVariationValue', () => {
  const cases: Array<[string, string, string[]]> = [
    ['a color name', 'Heather Grey', []],
    ['parentheses', 'Grey (Heather)', ['colors[0].name: contains parentheses, which Etsy does not allow']],
    ['empty', ' ', ['colors[0].name: is empty']],
  ];
  for (const [name, value, expected] of cases) {
    it(name, () => assert.deepEqual(show(checkVariationValue(value, 'colors[0].name')), expected));
  }
});
