// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useHistory } from '../utils/history';
import { Button } from './Button';
import { Spinner } from './Spinner';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const HistoryModal: React.FC<Props> = ({ open, onClose }) => {
  const { fetchHistory } = useHistory();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchHistory();
        setRows(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl max-h-[80vh] w-full max-w-2xl overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4 text-secondary">My Image History</h2>
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <p className="text-muted">No history yet.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="border-b py-3">
              <p className="text-xs text-muted mb-1">{new Date(r.created_at).toLocaleString()}</p>
              <img src={r.payload.url} className="w-32 rounded" />
            </div>
          ))
        )}
        <Button onClick={onClose} className="mt-4 w-full" variant="secondary">Close</Button>
      </div>
    </div>
  );
}; 