/**
 * givemeafuckingjob.com itself: the jobs, for visitors. A member is taken to their Feed instead, as
 * LinkedIn and Instagram do; a search in the address still opens the jobs, since that is what was asked for.
 */
import { me } from '/app.js'
import jobs from '/pages/jobsearch.js'

export default async function (ctx) {
  if (me && !location.search) return void location.replace('/feed')
  document.documentElement.classList.add('shown')
  return jobs(ctx)
}
