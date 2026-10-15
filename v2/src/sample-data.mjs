// Fictional catalogue: deliberately mixed categories to test relevance and exclusions.
const p=(id,title,category,price,emoji,more={})=>({
  id,title,category,priceCents:Math.round(price*100),emoji,productType:category,
  vendor:'Demo Store',available:true,published:true,tags:[],collections:[],metafields:{},...more,
});
export const products = [
  p('sofa-nova','Nova 3-Seater Sofa','sofas',499,'🛋️',{tags:['living-room','modern'],metafields:{'spec.material':'fabric','spec.colour':'beige'}}),
  p('sofa-alto','Alto 3-Seater Sofa','sofas',529,'🛋️',{tags:['living-room','modern'],metafields:{'spec.material':'velvet','spec.colour':'grey'}}),
  p('sofa-cove','Cove Compact Sofa','sofas',379,'🛋️',{tags:['living-room','compact'],metafields:{'spec.material':'fabric','spec.colour':'blue'}}),
  p('cushion-cream','Soft Linen Cushion','cushions',24,'◻️',{tags:['living-room','soft-furnishing'],metafields:{'spec.material':'linen'}}),
  p('cushion-olive','Velvet Cushion in Olive','cushions',29,'🟩',{tags:['living-room','soft-furnishing'],metafields:{'spec.material':'velvet'}}),
  p('throw-woven','Woven Cotton Throw','throws',37,'🧶',{tags:['living-room'],metafields:{'spec.material':'cotton'}}),
  p('throw-wool','Chunky Wool Throw','throws',49,'🧶',{tags:['living-room','clearance'],metafields:{'spec.material':'wool'}}),
  p('table-oak','Round Oak Coffee Table','coffee-tables',79,'🪵',{tags:['living-room'],metafields:{'spec.material':'oak'}}),
  p('sofa-out-of-stock','Riviera Sofa','sofas',599,'🛋️',{tags:['living-room'],available:false}),
  p('football-goal','Portable Football Goal','football-goals',79,'🥅',{tags:['sports','outdoor'],metafields:{'spec.size':'portable'}}),
  p('goal-net','Replacement Football Goal Net','goal-nets',19,'🥅',{tags:['sports','accessory']}),
  p('football','Training Football Size 5','footballs',17,'⚽',{tags:['sports','training']}),
  p('cones','Training Marker Cones – Pack of 20','training-cones',12,'🔶',{tags:['sports','training']}),
  p('cones-oos','Professional Training Cones','training-cones',22,'🔶',{tags:['sports'],available:false}),
  p('camera','Zeta Mirrorless Camera Z Mount','cameras',999,'📷',{tags:['electronics','photography'],metafields:{'compatibility.mount':'z','spec.sensor':'full-frame'}}),
  p('camera-alt','Zeta Compact Camera Z Mount','cameras',1099,'📸',{tags:['electronics'],metafields:{'compatibility.mount':'z'}}),
  p('lens-z','Z Mount Portrait Lens 50mm','camera-lenses',349,'🔭',{tags:['photography'],requires:{'compatibility.mount':'z'}}),
  p('lens-e','E Mount Portrait Lens 50mm','camera-lenses',299,'🔭',{tags:['photography'],requires:{'compatibility.mount':'e'}}),
  p('battery-z','Zeta Camera Battery','camera-batteries',49,'🔋',{tags:['photography'],requires:{'compatibility.mount':'z'}}),
  p('sd-card','Fast SD Memory Card 128GB','memory-cards',27,'💾',{tags:['electronics','photography']}),
  p('camera-bag','Padded Camera Bag','camera-bags',45,'🎒',{tags:['photography']}),
  p('cat-carrier','Adventure Cat Carrier Backpack','cat-carriers',65,'🎒',{tags:['pets','cat']}),
  p('cat-harness','Cat Adventure Harness','cat-harnesses',18,'🐈',{tags:['pets','cat']}),
  p('cat-bowl','Travel Pet Water Bowl','pet-accessories',12,'🥣',{tags:['pets']}),
];
export const pairs = {
  'sofa-nova':{'cushion-cream':18,'throw-woven':12,'table-oak':6,'football':1},
  'football-goal':{'football':8,'cones':5},
  'camera':{'sd-card':9,'battery-z':4,'lens-z':2},
};
export const defaultConfig={
  kind:'complement',mode:'hybrid',heading:'',maxItems:3,
  pinnedIds:[],manualIds:[],excludeIds:[],excludeTags:[],excludeCategories:[],ruleGroups:[],
  bundleDiscount:{type:'percentage',value:10},
};
