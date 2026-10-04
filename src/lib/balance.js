// Team balancer: split players into two equal-sized teams with the closest average rating.

const avg = (ids, ratings) =>
  ids.length ? ids.reduce((acc, id) => acc + ratings[id], 0) / ids.length : 0

export const teamAverage = (ids, ratings) => Math.round(avg(ids, ratings))

// `orderedIds` should be sorted strongest-first. Each player goes to the weaker side so far,
// unless that side is already full — sizes never differ by more than one.
function greedySplit(orderedIds, ratings) {
  const cap = Math.ceil(orderedIds.length / 2)
  const teamA = [], teamB = []
  let sumA = 0, sumB = 0
  for (const id of orderedIds) {
    const toA = teamB.length >= cap || (teamA.length < cap && sumA <= sumB)
    if (toA) { teamA.push(id); sumA += ratings[id] }
    else { teamB.push(id); sumB += ratings[id] }
  }
  return { teamA, teamB }
}

// Swap pairs across teams while it narrows the gap between the two averages.
function refine({ teamA, teamB }, ratings) {
  const a = [...teamA], b = [...teamB]
  const gap = () => Math.abs(avg(a, ratings) - avg(b, ratings))
  let improved = true
  while (improved) {
    improved = false
    let best = gap(), bestSwap = null
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        ;[a[i], b[j]] = [b[j], a[i]]
        const g = gap()
        if (g < best - 1e-9) { best = g; bestSwap = [i, j] }
        ;[a[i], b[j]] = [b[j], a[i]]
      }
    }
    if (bestSwap) {
      const [i, j] = bestSwap
      ;[a[i], b[j]] = [b[j], a[i]]
      improved = true
    }
  }
  return { teamA: a, teamB: b }
}

// Best split. `jitter` (rating points) adds randomness so "Shuffle" gives a different but still fair split.
export function balanceTeams(ids, ratings, { jitter = 0 } = {}) {
  const keyed = ids
    .map((id) => ({ id, key: ratings[id] + (jitter ? (Math.random() * 2 - 1) * jitter : 0) }))
    .sort((x, y) => y.key - x.key)
    .map((x) => x.id)
  const split = greedySplit(keyed, ratings)
  // With jitter we keep the randomised split as-is; refining would collapse back to the same answer.
  return jitter ? split : refine(split, ratings)
}
