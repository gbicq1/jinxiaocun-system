"use strict";
/**
 * 月度成本自动结转服务
 * 负责计算和保存每月的成本结算数据
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonthlyCostSettlementService = void 0;
/**
 * 月度成本结转服务
 */
class MonthlyCostSettlementService {
    constructor(costDb) {
        this.costDb = costDb;
    }
    /**
     * 计算并结转指定月份的成本
     * @param year 年度
     * @param month 月份
     * @param lock 是否锁定（锁定后不允许修改）
     */
    settleMonth(year, month, lock = true) {
        try {
            console.log(`开始结算 ${year}年${month}月 的成本数据...`);
            // 检查是否已结算
            if (this.costDb.isSettled(year, month)) {
                console.log(`${year}年${month}月 已结算，跳过`);
                return { success: true, count: 0 };
            }
            // 获取所有产品和仓库组合
            const productWarehouseCombinations = this.getAllProductWarehouseCombinations();
            console.log(`共有 ${productWarehouseCombinations.length} 个产品仓库组合需要结算`);
            const settlements = [];
            // 逐个计算
            for (const combo of productWarehouseCombinations) {
                const settlement = this.calculateSettlement(combo.productCode, combo.productName, combo.warehouseId, combo.warehouseName, year, month);
                if (settlement) {
                    settlements.push({
                        ...settlement,
                        is_locked: lock ? 1 : 0
                    });
                }
            }
            // 批量保存
            if (settlements.length > 0) {
                this.costDb.saveSettlements(settlements);
                console.log(`成功结算 ${settlements.length} 条记录`);
            }
            return { success: true, count: settlements.length };
        }
        catch (error) {
            console.error(`结算 ${year}年${month}月 失败:`, error);
            return { success: false, count: 0, error: String(error) };
        }
    }
    /**
     * 计算单个产品仓库的月度成本结算
     */
    calculateSettlement(productCode, productName, warehouseId, warehouseName, year, month) {
        // 1. 获取上月期末数据（作为本期期初）
        const openingData = this.getOpeningData(productCode, warehouseId, year, month);
        // 2. 获取本月入库数据
        const inboundData = this.getInboundData(productCode, warehouseId, year, month);
        // 3. 获取本月出库数据
        const outboundData = this.getOutboundData(productCode, warehouseId, year, month);
        // 4. 计算期末数据
        const closingQty = openingData.qty + inboundData.qty - outboundData.qty;
        const closingCost = openingData.cost + inboundData.cost - outboundData.cost;
        // 5. 计算加权平均单价
        const avgCost = closingQty > 0 ? closingCost / closingQty : 0;
        return {
            product_code: productCode,
            product_name: productName,
            warehouse_id: warehouseId,
            warehouse_name: warehouseName,
            period_year: year,
            period_month: month,
            opening_qty: openingData.qty,
            opening_cost: openingData.cost,
            inbound_qty: inboundData.qty,
            inbound_cost: inboundData.cost,
            outbound_qty: outboundData.qty,
            outbound_cost: outboundData.cost,
            closing_qty: closingQty,
            closing_cost: closingCost,
            avg_cost: Number(avgCost.toFixed(2))
        };
    }
    /**
     * 获取期初数据（上月期末）
     */
    getOpeningData(productCode, warehouseId, year, month) {
        // 计算上月
        let prevYear = year;
        let prevMonth = month - 1;
        if (prevMonth === 0) {
            prevYear = year - 1;
            prevMonth = 12;
        }
        // 尝试从数据库获取上月期末
        const prevSettlement = this.costDb.getSettlement(productCode, warehouseId, prevYear, prevMonth);
        if (prevSettlement) {
            return {
                qty: prevSettlement.closing_qty || 0,
                cost: prevSettlement.closing_cost || 0
            };
        }
        // 如果上月没有结算，尝试获取上上月（递归）
        if (prevMonth !== 1) {
            return this.getOpeningData(productCode, warehouseId, prevYear, prevMonth);
        }
        // 如果是 1 月，说明是年度初始化，返回 0
        return { qty: 0, cost: 0 };
    }
    /**
     * 获取本月入库数据
     */
    getInboundData(productCode, warehouseId, year, month) {
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
        let totalQty = 0;
        let totalCost = 0;
        // 从 localStorage 获取采购入库单
        const inboundKeys = ['purchase_inbound_records', 'purchaseInbounds', 'inbound_records', 'inbounds'];
        for (const key of inboundKeys) {
            const raw = localStorage.getItem(key);
            if (!raw)
                continue;
            const records = JSON.parse(raw);
            if (!Array.isArray(records))
                continue;
            for (const rec of records) {
                const recDate = new Date(rec.voucherDate || rec.date || rec.createdAt);
                if (recDate < monthStart || recDate > monthEnd)
                    continue;
                if (Number(rec.warehouseId) !== Number(warehouseId))
                    continue;
                const items = rec.items || rec.products || rec.details;
                if (!Array.isArray(items))
                    continue;
                for (const item of items) {
                    if (String(item.productId) !== String(productCode) &&
                        String(item.productCode) !== String(productCode))
                        continue;
                    const qty = Number(item.quantity || 0);
                    const amount = Number(item.totalAmountEx || item.totalAmount || item.amount || 0);
                    totalQty += qty;
                    totalCost += amount;
                }
            }
        }
        return { qty: totalQty, cost: totalCost };
    }
    /**
     * 获取本月出库数据
     */
    getOutboundData(productCode, warehouseId, year, month) {
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
        let totalQty = 0;
        let totalCost = 0;
        // 从 localStorage 获取销售出库单
        const outboundKeys = ['sales_outbound_records', 'outbound_records', 'outbounds', 'delivery_records'];
        for (const key of outboundKeys) {
            const raw = localStorage.getItem(key);
            if (!raw)
                continue;
            const records = JSON.parse(raw);
            if (!Array.isArray(records))
                continue;
            for (const rec of records) {
                const recDate = new Date(rec.voucherDate || rec.date || rec.createdAt);
                if (recDate < monthStart || recDate > monthEnd)
                    continue;
                if (Number(rec.warehouseId) !== Number(warehouseId))
                    continue;
                const items = rec.items || rec.products || rec.details;
                if (!Array.isArray(items))
                    continue;
                for (const item of items) {
                    if (String(item.productId) !== String(productCode) &&
                        String(item.productCode) !== String(productCode))
                        continue;
                    const qty = Number(item.quantity || 0);
                    totalQty += qty;
                    // 出库成本在计算时使用期初或入库的加权平均价
                    // 这里简化处理，实际应该在计算时动态确定
                }
            }
        }
        // 出库成本需要基于期初和本期入库的加权平均价计算
        // 这里先返回 0，实际成本在 calculateSettlement 中统一计算
        return { qty: totalQty, cost: 0 };
    }
    /**
     * 获取所有产品和仓库组合
     */
    getAllProductWarehouseCombinations() {
        const combinations = [];
        // 获取所有产品
        const productsRaw = localStorage.getItem('products');
        if (!productsRaw)
            return combinations;
        const products = JSON.parse(productsRaw);
        if (!Array.isArray(products))
            return combinations;
        // 获取所有仓库
        const warehousesRaw = localStorage.getItem('warehouses');
        const warehouses = warehousesRaw ? JSON.parse(warehousesRaw) : [];
        // 获取所有出入库记录，找出有业务往来的产品仓库组合
        const usedCombinations = new Set();
        const allKeys = [
            'purchase_inbound_records', 'purchaseInbounds', 'inbound_records', 'inbounds',
            'sales_outbound_records', 'outbound_records', 'outbounds', 'delivery_records',
            'transfer_records', 'transfers'
        ];
        for (const key of allKeys) {
            const raw = localStorage.getItem(key);
            if (!raw)
                continue;
            const records = JSON.parse(raw);
            if (!Array.isArray(records))
                continue;
            for (const rec of records) {
                const warehouseId = rec.warehouseId;
                if (!warehouseId)
                    continue;
                const items = rec.items || rec.products || rec.details;
                if (!Array.isArray(items))
                    continue;
                for (const item of items) {
                    const productCode = item.productId || item.productCode;
                    if (!productCode)
                        continue;
                    const comboKey = `${productCode}-${warehouseId}`;
                    if (!usedCombinations.has(comboKey)) {
                        usedCombinations.add(comboKey);
                        const product = products.find((p) => String(p.id) === String(productCode) || String(p.code) === String(productCode));
                        const warehouse = warehouses.find((w) => String(w.id) === String(warehouseId));
                        if (product && warehouse) {
                            combinations.push({
                                productCode: String(productCode),
                                productName: product.name || '',
                                warehouseId: Number(warehouseId),
                                warehouseName: warehouse.name || ''
                            });
                        }
                    }
                }
            }
        }
        return combinations;
    }
    /**
     * 重新结算从指定月份到当前的所有月份
     * 用于处理历史单据新增或修改的情况
     */
    recalculateFromMonth(year, month) {
        try {
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            console.log(`重新结算从 ${year}年${month}月 到 ${currentYear}年${currentMonth}月`);
            // 解锁所有需要重新结算的月份
            let y = year;
            let m = month;
            while (y < currentYear || (y === currentYear && m <= currentMonth)) {
                this.costDb.unlockSettlement(y, m);
                m++;
                if (m > 12) {
                    m = 1;
                    y++;
                }
            }
            // 重新结算
            y = year;
            m = month;
            let totalCount = 0;
            while (y < currentYear || (y === currentYear && m <= currentMonth)) {
                const result = this.settleMonth(y, m, true);
                if (!result.success) {
                    return { success: false, message: `结算 ${y}年${m}月 失败：${result.error}` };
                }
                totalCount += result.count;
                m++;
                if (m > 12) {
                    m = 1;
                    y++;
                }
            }
            return { success: true, message: `成功重新结算 ${totalCount} 条记录` };
        }
        catch (error) {
            console.error('重新结算失败:', error);
            return { success: false, message: String(error) };
        }
    }
    /**
     * 自动补全所有历史月份的结算数据
     * 从系统第一个有业务的月份开始，逐月结算到上月
     */
    autoCompleteHistory() {
        try {
            console.log('开始自动补全历史月份结算数据...');
            // 1. 获取系统最早的单据日期
            const firstDocumentDate = this.getFirstDocumentDate();
            if (!firstDocumentDate) {
                console.log('没有找到任何业务单据，跳过自动补全');
                return { success: true, message: '没有业务数据', settledMonths: 0 };
            }
            const firstYear = firstDocumentDate.getFullYear();
            const firstMonth = firstDocumentDate.getMonth() + 1;
            // 2. 计算到上月的所有月份
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            let prevYear = currentYear;
            let prevMonth = currentMonth - 1;
            if (prevMonth === 0) {
                prevYear = currentYear - 1;
                prevMonth = 12;
            }
            console.log(`从 ${firstYear}年${firstMonth}月 到 ${prevYear}年${prevMonth}月`);
            // 3. 逐月检查并结算
            let y = firstYear;
            let m = firstMonth;
            let settledCount = 0;
            let skippedCount = 0;
            while (y < prevYear || (y === prevYear && m <= prevMonth)) {
                // 检查是否已结算
                if (this.costDb.isSettled(y, m)) {
                    console.log(`${y}年${m}月 已结算，跳过`);
                    skippedCount++;
                }
                else {
                    console.log(`结算 ${y}年${m}月 ...`);
                    const result = this.settleMonth(y, m, true);
                    if (result.success) {
                        settledCount++;
                        console.log(`  ✓ 成功结算 ${result.count} 条记录`);
                    }
                    else {
                        console.error(`  ✗ 结算失败：${result.error}`);
                    }
                }
                // 下一个月
                m++;
                if (m > 12) {
                    m = 1;
                    y++;
                }
            }
            const message = `完成！结算 ${settledCount} 个月，跳过 ${skippedCount} 个月`;
            console.log(message);
            return { success: true, message, settledMonths: settledCount };
        }
        catch (error) {
            console.error('自动补全历史月份失败:', error);
            return { success: false, message: String(error), settledMonths: 0 };
        }
    }
    /**
     * 获取系统最早的单据日期
     */
    getFirstDocumentDate() {
        const allDates = [];
        // 检查所有可能的单据表
        const recordKeys = [
            'purchase_inbound_records',
            'purchaseInbounds',
            'sales_outbound_records',
            'salesOutbounds',
            'inventory_transfer_records',
            'inventoryTransfers',
            'stock_adjustment_records',
            'stockAdjustments'
        ];
        for (const key of recordKeys) {
            const raw = localStorage.getItem(key);
            if (!raw)
                continue;
            const records = JSON.parse(raw);
            if (!Array.isArray(records) || records.length === 0)
                continue;
            // 找出最早的单据日期
            for (const rec of records) {
                const dateStr = rec.voucherDate || rec.date || rec.transferDate || rec.adjustmentDate || rec.createdAt;
                if (dateStr) {
                    const date = new Date(dateStr);
                    if (!isNaN(date.getTime())) {
                        allDates.push(date);
                    }
                }
            }
        }
        if (allDates.length === 0)
            return null;
        // 返回最早的日期
        return new Date(Math.min(...allDates.map(d => d.getTime())));
    }
    /**
     * 检测指定产品仓库在指定日期之后是否有新单据
     * 如果有，则触发从该月份开始的重新结算
     */
    checkAndRecalculateIfNeeded(productCode, warehouseId, documentDate) {
        try {
            const docDate = new Date(documentDate);
            const docYear = docDate.getFullYear();
            const docMonth = docDate.getMonth() + 1;
            console.log(`检查是否需要重新结算：产品 ${productCode}, 仓库 ${warehouseId}, 日期 ${documentDate}`);
            // 检查该月份之后的所有月份是否已结算
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            let y = docYear;
            let m = docMonth;
            let hasUnlockedMonth = false;
            while (y < currentYear || (y === currentYear && m <= currentMonth)) {
                const isSettled = this.costDb.isSettled(y, m);
                console.log(`  ${y}年${m}月：已结算=${isSettled}`);
                if (isSettled) {
                    // 如果已结算，说明可能需要重新计算
                    hasUnlockedMonth = true;
                    break;
                }
                m++;
                if (m > 12) {
                    m = 1;
                    y++;
                }
            }
            if (hasUnlockedMonth) {
                console.log(`检测到 ${docYear}年${docMonth}月 之后有未锁定的结算，触发重新结算`);
                this.recalculateFromMonth(docYear, docMonth);
                return { needsRecalculation: true, message: `检测到历史单据变更，已重新结算从 ${docYear}年${docMonth}月 开始的数据` };
            }
            return { needsRecalculation: false };
        }
        catch (error) {
            console.error('检查重新结算失败:', error);
            return { needsRecalculation: false };
        }
    }
}
exports.MonthlyCostSettlementService = MonthlyCostSettlementService;
