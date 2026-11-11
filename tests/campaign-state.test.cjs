const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../assets/campaign-state.js'), 'utf8');
function setup() {
  const state = {value:'',dataset:{},options:[{value:''}],appendChild(o){this.options.push(o);}};
  const country = {value:'US',events:{},addEventListener(k,f){this.events[k]=f;}};
  const phone = {value:'2025550123',events:{},addEventListener(k,f){this.events[k]=f;}};
  const field = {style:{},hidden:false};
  const els = {emState:state,emCountry:country,emPhone:phone,emStateField:field};
  const ctx = {
    document:{readyState:'complete',getElementById:id=>els[id],createElement:()=>({})},
    sessionStorage:{getItem:()=>null},
    window:{LLA_US:{validatePhone:()=>({ok:true,e164:'+12025550123'}),stateForAreaCode:()=> 'DC'}}
  };
  vm.runInNewContext(source,ctx);
  return {state,country,phone,field};
}
test('campaign selector has 50 states and DC without a second country selector',()=>{
  const h=setup();assert.equal(h.state.options.length,52);
  assert.equal(new Set(h.state.options.slice(1).map(x=>x.value)).size,51);
  assert.equal(h.field.hidden,false);
});
test('phone suggestion never overwrites the selected state',()=>{
  const h=setup();h.phone.events.blur();assert.equal(h.state.value,'DC');
  h.state.value='CA';h.phone.events.blur();assert.equal(h.state.value,'CA');
});
test('non-US country hides and clears US state; changing back restores the field',()=>{
  const h=setup();h.state.value='CA';h.country.value='IL';h.country.events.change();
  assert.equal(h.field.hidden,true);assert.equal(h.state.disabled,true);assert.equal(h.state.value,'');
  h.country.value='US';h.country.events.change();assert.equal(h.field.hidden,false);assert.equal(h.state.disabled,false);
});
test('campaign modal forwards the explicitly selected state into existing order builder',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const src=fs.readFileSync(path.join(__dirname,'../nov/eteacher-ecomm.js'),'utf8');
  assert.match(html,/stateIso:\(document\.getElementById\('emState'\)/);
  assert.match(src,/stateCode = fields\.stateIso \|\|/);
  assert.match(html,/id="emState"[^>]*data-lla-country-done="1"/);
});
