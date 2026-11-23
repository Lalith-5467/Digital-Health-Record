import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { nurseOpsApi } from '../../../services/dhrApis';

export const NurseInventoryView: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadInventory = async () => {
    try {
      setLoading(true);
      const res = await nurseOpsApi.getInventory();
      if (res?.data && Array.isArray(res.data)) {
        setItems(
          res.data.map((it: any) => ({
            id: it.id,
            name: it.itemName,
            category: it.category || 'Consumables',
            stock: Number(it.quantity ?? 0),
            minRequired: Number(it.minThreshold ?? 5),
            unit: it.unit || 'units',
            status: Number(it.quantity ?? 0) <= Number(it.minThreshold ?? 5) ? 'Low Stock' : 'In Stock',
          }))
        );
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const handleAddItem = async () => {
    const itemName = prompt('Enter Medical Kit Item Name (e.g., Sterile Gauze Pads):');
    if (!itemName || !itemName.trim()) return;
    const category = prompt('Category (e.g., Dressing, IV Fluids, Diagnostics):', 'Consumables') || 'Consumables';
    const quantity = Number(prompt('Current Quantity:', '10') || '10');
    const minThreshold = Number(prompt('Minimum Threshold:', '5') || '5');
    try {
      await nurseOpsApi.createInventoryItem({ itemName: itemName.trim(), category, quantity, minThreshold, unit: 'Units' });
      await loadInventory();
      showToast(`${itemName.trim()} added to MySQL medical kit inventory.`);
    } catch {
      showToast('Failed to add inventory item.');
    }
  };

  const handleRestock = async (item: any) => {
    try {
      await nurseOpsApi.createRestockRequest({
        itemName: item.name,
        quantity: Math.max(10, item.minRequired * 2),
        urgency: item.status === 'Low Stock' ? 'Urgent' : 'Normal',
      });
      showToast(`Restock requisition saved to database for ${item.name}!`);
    } catch {
      showToast('Failed to submit restock requisition.');
    }
  };

  const handleRestockAllLow = async () => {
    const lowItems = items.filter((i) => i.status === 'Low Stock');
    if (lowItems.length === 0) {
      showToast('All kit supplies are above minimum stock levels.');
      return;
    }
    try {
      await Promise.all(
        lowItems.map((it) =>
          nurseOpsApi.createRestockRequest({
            itemName: it.name,
            quantity: Math.max(10, it.minRequired * 2),
            urgency: 'Urgent',
          })
        )
      );
      showToast(`Bulk restock requisition persisted for ${lowItems.length} low-stock items!`);
    } catch {
      showToast('Failed to submit bulk restock requisition.');
    }
  };

  return (
    <div className="space-y-6 pb-16 font-sans select-none">
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none select-none max-w-md w-full px-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="pointer-events-auto select-auto px-5 py-3 rounded-2xl bg-[#00a896] text-white font-black text-xs shadow-2xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toast}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-cyan-400 text-xs font-black uppercase tracking-wider mb-1">
            <Package className="w-3.5 h-3.5" /> Clinical Bag Telemetry
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Medical Kit & Consumables Inventory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Monitor and restock sterile dressings, IV catheters, and diagnostic consumables carried on shift.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAddItem}
            className="px-4 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supply</span>
          </button>
          <button
            onClick={handleRestockAllLow}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-black text-xs shadow-lg shadow-teal-500/20 flex items-center gap-2 self-start sm:self-auto cursor-pointer transition-all hover:scale-105"
          >
            <RefreshCw className="w-4 h-4" />
            <span>1-Click Restock All Low Items</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
            Mobile Clinical Medical Kit
          </h3>
          <span className="text-[11px] font-mono text-slate-400">{items.length} Items Tracked</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {loading ? (
            <div className="p-10 text-center text-xs text-slate-400">Loading medical kit inventory from database...</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400">
              No supplies logged yet. Click &quot;Add Supply&quot; to record items in your mobile kit.
            </div>
          ) : (
            items.map((item) => {
              const isLow = item.status === 'Low Stock';
              return (
                <div key={item.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${isLow ? 'bg-amber-500/15 text-amber-600' : 'bg-teal-500/15 text-[#00a896]'
                      }`}>
                      {isLow ? <AlertTriangle className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">{item.name}</h4>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${isLow ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">Category: {item.category}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 justify-between sm:justify-end text-xs">
                    <div className="text-right font-mono">
                      <p className="text-base font-black text-slate-900 dark:text-white leading-none">
                        {item.stock} {item.unit}
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-1">Min: {item.minRequired} {item.unit}</span>
                    </div>

                    <button
                      onClick={() => handleRestock(item)}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-teal-50 dark:bg-slate-800 dark:hover:bg-teal-950/40 text-slate-700 hover:text-teal-700 dark:text-slate-200 dark:hover:text-cyan-300 font-black text-xs transition-colors cursor-pointer shrink-0"
                    >
                      Request Restock
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
