import {test } from 'vitest';
import assert from 'node:assert/strict';
import {generateStyleLooks,replaceStylePiece} from './styleGenerator.js';
const items=[
  ['a','top','Blue linen shirt','blue'],['b','bottom','Blue jeans','navy'],
  ['c','bottom','Cream trousers','cream'],['d','shoes','White sneakers','white'],
  ['e','shoes','Brown loafers','brown'],['f','outerwear','Light cardigan','cream'],
  ['g','bag','Tan tote','beige']
].map(([id,category,name,color])=>({_id:id,category,name,color,style:'Casual',occasion:'University',season:'Spring'}));
const opts={occasion:'University',style:'Casual',weather:'mild',season:'Spring'};
test('locked top stays in every generated look',()=>{
  const result=generateStyleLooks(items,opts,['a'],[],3);
  assert.equal(result.looks.length,3);
  for(const l of result.looks)assert.ok(l.clothingItemIds.includes('a'));
});
test('replace bottom preserves other items and locked top',()=>{
  const l=generateStyleLooks(items,opts,['a'],[],1).looks[0];
  const r=replaceStylePiece(items,l.clothingItemIds,'bottom',['a'],opts);
  assert.ok(r.look);
  assert.ok(r.look.clothingItemIds.includes('a'));
  assert.notEqual(l.items.find(i=>i.category==='bottom')._id,r.look.items.find(i=>i.category==='bottom')._id);
  for(const i of l.items.filter(i=>i.category!=='bottom'))assert.ok(r.look.clothingItemIds.includes(i._id));
});
test('a locked item cannot be replaced',()=>{
  const l=generateStyleLooks(items,opts,['a'],[],1).looks[0];
  assert.match(replaceStylePiece(items,l.clothingItemIds,'top',['a'],opts).error,/Unlock/i);
});
test('sensible constraints reject beachwear for university',()=>{
  const beach={_id:'z',category:'top',name:'Bikini swimwear',style:'Beach',occasion:'Beach'};
  const looks=generateStyleLooks([beach,...items],opts,[],[],5).looks;
  assert.ok(looks.every(l=>!l.clothingItemIds.includes('z')));
});
