import { toast } from 'sonner'
import { pushProductionCommit } from '../utils/productionPush'

// Lightweight hook to trigger production commits after UI mutations
export function useProductionCommit() {
  const commit = async (message: string) => {
    try {
      await pushProductionCommit({ commitMessage: message })
      toast.success('Changes pushed to main (production).')
    } catch (err: any) {
      toast.error('Production push failed: ' + (err?.message ?? err))
    }
  }
  return { commit }
}
