import type { SvgDocument } from '../../src/domain/document/SvgDocument.js';
import type { EditTransaction } from '../../src/domain/transactions/EditTransaction.js';
export const edit = (doc: SvgDocument, run: (tx: EditTransaction) => void) => {
  const lease = doc.beginEdit();
  try {
    run(lease.tx);
    const changes = lease.prepare();
    lease.commitPrepared();
    return changes;
  } catch (error) {
    if (lease.tx.phase === 'active' || lease.tx.phase === 'prepared') lease.rollback();
    throw error;
  }
};
