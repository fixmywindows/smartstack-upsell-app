/**
 * Pure rule-set selector for SmartStack. No database, Shopify token or HTTP
 * dependencies; predictable behaviour can be tested without a running shop.
 * The caller must scope sets to the authenticated merchant before calling.
 */
export function sortRuleSets(sets) {
  const specificity = set => ({products: 3, rules: 2, all: 1})[set.sourceMatch] || 0;
  const time = set => {
    const timestamp = new Date(set.createdAt || 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  };
  return [...sets].sort((a,b) =>
    (a.priority - b.priority)
    || (specificity(b) - specificity(a))
    || (time(a) - time(b))
    || String(a.id).localeCompare(String(b.id))
  );
}

export function ruleSetApplies(set, source, sourceId, evaluateGroups, normaliseGroups) {
  if (set.sourceMatch === 'all') return {matched:true, reason:'Applies to all products'};
  if (set.sourceMatch === 'products') {
    const selected = Array.isArray(set.sourceProductIds) ? set.sourceProductIds : [];
    const matched = selected.includes(sourceId);
    return {matched,reason:matched?'Source product explicitly selected':'Source product not selected'};
  }
  if (set.sourceMatch === 'rules') {
    const groups = normaliseGroups(set.sourceRules,set.sourceLogic);
    if (!groups.length || !groups.some(g => g.rules?.length)) {
      return {matched:false,reason:'No source conditions configured'};
    }
    const matched = evaluateGroups(source,groups,set.sourceLogic);
    return {matched,reason:matched?'Source conditions matched':'Source conditions did not match'};
  }
  return {matched:false,reason:'Unknown source targeting'};
}

/**
 * @param {Object} args
 * @param {Array<Object>} args.sets Rules already scoped to one merchant and type
 * @param {Object} args.source Current product
 * @param {string} args.sourceId Product GID
 * @param {Function} args.evaluateGroups Pure condition evaluator
 * @param {Function} args.normaliseGroups Backward-compatible group parser
 * @param {Function} args.recommendForSet Returns a recommendation result
 * @param {string|null} [args.previewSetId] Optional authenticated admin-only override
 * @returns {{selection:Object|null, trace:Array<Object>}}
 */
export function resolveRuleSets({
  sets, source, sourceId, evaluateGroups, normaliseGroups, recommendForSet,
  previewSetId = null,
}) {
  const trace=[];
  for (const set of sortRuleSets(sets)) {
    const entry={
      id:set.id,name:set.name,priority:set.priority,
      status:set.archived?'archived':set.enabled?'active':'draft',
      sourceMatched:false,productCount:0,decision:'skipped',reason:'',
    };
    if (set.archived) {
      entry.reason='Archived set';trace.push(entry);continue;
    }
    if (previewSetId && set.id !== previewSetId) {
      entry.reason='Another set selected for preview';trace.push(entry);continue;
    }
    if (!previewSetId && !set.enabled) {
      entry.reason='Set is paused or a draft';trace.push(entry);continue;
    }
    const applies=ruleSetApplies(set,source,sourceId,evaluateGroups,normaliseGroups);
    entry.sourceMatched=applies.matched;
    entry.reason=applies.reason;
    if (!applies.matched) {
      entry.decision='source_mismatch';trace.push(entry);continue;
    }

    const output=recommendForSet(set);
    entry.productCount=output?.items?.length||0;
    if (entry.productCount>0) {
      entry.decision='selected';
      entry.reason='Matched source and found '+entry.productCount+' eligible recommendation(s)';
      trace.push(entry);
      return {selection:{set,output},trace};
    }

    if (previewSetId || set.fallbackMode === 'stop') {
      entry.decision='stopped_empty';
      entry.reason=previewSetId
        ? 'Selected preview has no eligible recommendations (storefront fallback is not being simulated)'
        : 'No eligible recommendations; the set is configured to stop here';
      trace.push(entry);
      return {selection:{set,output},trace};
    }
    entry.decision='fallback';
    entry.reason='No eligible recommendations; checking the next matching set';
    trace.push(entry);
  }
  return {selection:null,trace};
}
