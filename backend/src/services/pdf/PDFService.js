'use strict';

const PDFDocument = require('pdfkit');

/**
 * PDFService — generate financial reports and receipts using PDFKit.
 * Returns a Buffer — caller handles upload to Supabase Storage.
 *
 * Uses PDFKit (not Puppeteer) — lightweight, no browser dependency.
 */
class PDFService {
  /**
   * Helper to draw a standard header banner on a page.
   */
  _drawHeader(doc, title, subtitle, isA5 = false) {
    const margin = isA5 ? 30 : 40;
    const pageWidth = doc.page.width;
    
    // Top primary color accent strip
    doc.rect(0, 0, pageWidth, 8).fill('#4F46E5');
    
    // Logo & Branding
    doc.fillColor('#4F46E5')
      .fontSize(isA5 ? 13 : 16)
      .font('Helvetica-Bold')
      .text('NjangiBridge', margin, 22);
      
    // Document Title
    doc.fillColor('#1F2937')
      .fontSize(isA5 ? 10 : 12)
      .font('Helvetica-Bold')
      .text(title.toUpperCase(), margin, 24, { align: 'right', width: pageWidth - 2 * margin });
      
    if (subtitle) {
      doc.fillColor('#6B7280')
        .fontSize(isA5 ? 7.5 : 9)
        .font('Helvetica')
        .text(subtitle, margin, 38, { align: 'right', width: pageWidth - 2 * margin });
    }
    
    // Divider line
    doc.strokeColor('#E5E7EB')
      .lineWidth(0.75)
      .moveTo(margin, 52)
      .lineTo(pageWidth - margin, 52)
      .stroke();
  }

  /**
   * Helper to draw a footer.
   */
  _drawFooter(doc, text, isA5 = false) {
    const margin = isA5 ? 30 : 40;
    const pageHeight = doc.page.height;
    const pageWidth = doc.page.width;
    
    doc.strokeColor('#E5E7EB')
      .lineWidth(0.5)
      .moveTo(margin, pageHeight - 45)
      .lineTo(pageWidth - margin, pageHeight - 45)
      .stroke();
      
    doc.fillColor('#9CA3AF')
      .fontSize(isA5 ? 7 : 8)
      .font('Helvetica')
      .text(text || 'This is a secure computer-generated document. NjangiBridge © 2026.', margin, pageHeight - 35, {
        align: 'center',
        width: pageWidth - 2 * margin
      });
  }

  /**
   * Helper to format values
   */
  _formatDateTime(dateStr) {
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return { date: '—', time: '—' };
    
    const date = dateObj.toLocaleDateString('en-CM', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = dateObj.toLocaleTimeString('en-CM', { hour: '2-digit', minute: '2-digit' });
    return { date, time };
  }

  /**
   * Generate a single-page payment receipt.
   * @param {{ memberName, amount, method, date, groupName, cycleNumber }} contribution
   * @returns {Promise<Buffer>}
   */
  generateReceiptPDF(contribution) {
    const doc = new PDFDocument({ margin: 30, size: 'A5' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    this._drawHeader(doc, 'Payment Receipt', contribution.groupName, true);

    const boxX = 30;
    const boxY = 65;
    const boxW = doc.page.width - 60;
    const boxH = 75;
    
    // Card background & border
    doc.roundedRect(boxX, boxY, boxW, boxH, 6)
      .fillColor('#F9FAFB')
      .fill();
    doc.roundedRect(boxX, boxY, boxW, boxH, 6)
      .strokeColor('#E5E7EB')
      .lineWidth(1)
      .stroke();

    // Text inside card
    doc.fillColor('#6B7280')
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('AMOUNT PAID', boxX + 15, boxY + 12);
      
    doc.fillColor('#1F2937')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(`${contribution.amount?.toLocaleString()} FCFA`, boxX + 15, boxY + 23);
      
    const { date, time } = this._formatDateTime(contribution.date);
    doc.fillColor('#4B5563')
      .fontSize(8)
      .font('Helvetica')
      .text(`Date: ${date} at ${time}`, boxX + 15, boxY + 48);

    // Status Badge
    const statusText = (contribution.status || 'confirmed').toUpperCase();
    const isSuccess = ['CONFIRMED', 'PAID', 'SUCCESS'].includes(statusText);
    const badgeBg = isSuccess ? '#E6F4EA' : '#FFF3CD';
    const badgeTextCol = isSuccess ? '#137333' : '#B06000';
    
    doc.roundedRect(doc.page.width - 125, boxY + 22, 80, 20, 4)
      .fillColor(badgeBg)
      .fill();
      
    doc.fillColor(badgeTextCol)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(statusText, doc.page.width - 125, boxY + 28, { width: 80, align: 'center' });

    // Details Grid Title
    doc.fillColor('#374151')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('TRANSACTION DETAILS', 30, 155);

    const details = [
      { label: 'Contributor', value: contribution.memberName },
      { label: 'Njangi Group', value: contribution.groupName },
      { label: 'Njangi Cycle', value: `Cycle ${contribution.cycleNumber}` },
      { label: 'Payment Method', value: contribution.method?.toUpperCase() || 'MOBILE MONEY' },
    ];

    let currentY = 170;
    for (const item of details) {
      doc.strokeColor('#F3F4F6')
        .lineWidth(1)
        .moveTo(30, currentY)
        .lineTo(doc.page.width - 30, currentY)
        .stroke();

      doc.fillColor('#6B7280')
        .fontSize(8)
        .font('Helvetica')
        .text(item.label, 30, currentY + 6);

      doc.fillColor('#1F2937')
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(item.value, 150, currentY + 6, { width: doc.page.width - 180, align: 'right' });

      currentY += 22;
    }

    doc.strokeColor('#F3F4F6')
      .lineWidth(1)
      .moveTo(30, currentY)
      .lineTo(doc.page.width - 30, currentY)
      .stroke();

    this._drawFooter(doc, 'All transactions are logged on the secure, immutable Njangi ledger.', true);
    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Generate a single-page payout receipt.
   * @param {{ recipientName, amount, method, date, groupName, cycleNumber, status }} payout
   * @returns {Promise<Buffer>}
   */
  generatePayoutReceiptPDF(payout) {
    const doc = new PDFDocument({ margin: 30, size: 'A5' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    this._drawHeader(doc, 'Payout Confirmation', payout.groupName, true);

    const boxX = 30;
    const boxY = 65;
    const boxW = doc.page.width - 60;
    const boxH = 75;
    
    // Card background & border
    doc.roundedRect(boxX, boxY, boxW, boxH, 6)
      .fillColor('#EEF2F6')
      .fill();
    doc.roundedRect(boxX, boxY, boxW, boxH, 6)
      .strokeColor('#D8E2EF')
      .lineWidth(1)
      .stroke();

    // Text inside card
    doc.fillColor('#4B5563')
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('PAYOUT AMOUNT DISBURSED', boxX + 15, boxY + 12);
      
    doc.fillColor('#1E3A8A')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(`${payout.amount?.toLocaleString()} FCFA`, boxX + 15, boxY + 23);
      
    const { date, time } = this._formatDateTime(payout.date);
    doc.fillColor('#4B5563')
      .fontSize(8)
      .font('Helvetica')
      .text(`Received: ${date} at ${time}`, boxX + 15, boxY + 48);

    // Status Badge
    const statusText = (payout.status || 'completed').toUpperCase();
    const isSuccess = ['COMPLETED', 'EXECUTED', 'SUCCESS'].includes(statusText);
    const badgeBg = isSuccess ? '#E6F4EA' : '#FFF3CD';
    const badgeTextCol = isSuccess ? '#137333' : '#B06000';
    
    doc.roundedRect(doc.page.width - 125, boxY + 22, 80, 20, 4)
      .fillColor(badgeBg)
      .fill();
      
    doc.fillColor(badgeTextCol)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(statusText, doc.page.width - 125, boxY + 28, { width: 80, align: 'center' });

    // Details Grid Title
    doc.fillColor('#374151')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('PAYOUT DETAILS', 30, 155);

    const details = [
      { label: 'Recipient Name', value: payout.recipientName },
      { label: 'Njangi Group', value: payout.groupName },
      { label: 'Njangi Cycle', value: `Cycle ${payout.cycleNumber}` },
      { label: 'Disbursement Method', value: payout.method?.toUpperCase() || 'MOBILE MONEY' },
    ];

    let currentY = 170;
    for (const item of details) {
      doc.strokeColor('#F3F4F6')
        .lineWidth(1)
        .moveTo(30, currentY)
        .lineTo(doc.page.width - 30, currentY)
        .stroke();

      doc.fillColor('#6B7280')
        .fontSize(8)
        .font('Helvetica')
        .text(item.label, 30, currentY + 6);

      doc.fillColor('#1F2937')
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(item.value, 150, currentY + 6, { width: doc.page.width - 180, align: 'right' });

      currentY += 22;
    }

    doc.strokeColor('#F3F4F6')
      .lineWidth(1)
      .moveTo(30, currentY)
      .lineTo(doc.page.width - 30, currentY)
      .stroke();

    this._drawFooter(doc, 'Disbursements are executed via secure mobile money routes. Verified transaction record.', true);
    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Generate a full group financial report.
   * @param {{ name: string }} groupData
   * @param {{ totalContributed, totalPaidOut, balance, cycles: Array }} ledgerData
   * @returns {Promise<Buffer>}
   */
  generateLedgerReport(groupData, ledgerData) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    const drawPageTemplate = () => {
      this._drawHeader(doc, 'Group Ledger Report', groupData.name);
      this._drawFooter(doc, 'Ledger log of Njangi activities. All transactions are permanent & immutable.');
    };

    drawPageTemplate();

    // Summary Card / Section
    const boxX = 40;
    const boxY = 65;
    const boxW = doc.page.width - 80;
    const boxH = 50;
    
    doc.roundedRect(boxX, boxY, boxW, boxH, 6)
      .fillColor('#F9FAFB')
      .fill();
    doc.roundedRect(boxX, boxY, boxW, boxH, 6)
      .strokeColor('#E5E7EB')
      .lineWidth(0.75)
      .stroke();

    // Horizontal Summary Details
    const colW = boxW / 3;
    const stats = [
      { label: 'TOTAL CONTRIBUTED', val: `${ledgerData.totalContributed?.toLocaleString()} FCFA` },
      { label: 'TOTAL PAID OUT', val: `${ledgerData.totalPaidOut?.toLocaleString()} FCFA` },
      { label: 'CURRENT BALANCE', val: `${ledgerData.balance?.toLocaleString()} FCFA` }
    ];

    stats.forEach((s, idx) => {
      const startColX = boxX + idx * colW;
      
      // label
      doc.fillColor('#6B7280')
        .fontSize(7.5)
        .font('Helvetica-Bold')
        .text(s.label, startColX + 15, boxY + 12);
      
      // val
      doc.fillColor('#1F2937')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(s.val, startColX + 15, boxY + 24);

      // divider
      if (idx < 2) {
        doc.strokeColor('#E5E7EB')
          .lineWidth(0.5)
          .moveTo(startColX + colW, boxY + 10)
          .lineTo(startColX + colW, boxY + boxH - 10)
          .stroke();
      }
    });

    // Compile list of ledger entries
    const transactions = [];
    for (const cycle of (ledgerData.cycles || [])) {
      if (cycle.payout) {
        transactions.push({
          date: cycle.payout.date || '',
          cycleNumber: cycle.cycleNumber,
          type: 'Payout',
          member: cycle.payout.recipientName,
          method: 'Mobile Money',
          amount: `- ${Number(cycle.payout.amount).toLocaleString()} FCFA`,
          status: 'success'
        });
      }
      for (const contrib of (cycle.contributions || [])) {
        transactions.push({
          date: contrib.date || '',
          cycleNumber: cycle.cycleNumber,
          type: 'Contribution',
          member: contrib.memberName,
          method: 'MoMo/Cash',
          amount: `+ ${Number(contrib.amount).toLocaleString()} FCFA`,
          status: contrib.status
        });
      }
    }

    // Sort by cycle ascending, type (payout last), then date ascending
    transactions.sort((a, b) => {
      if (a.cycleNumber !== b.cycleNumber) return a.cycleNumber - b.cycleNumber;
      if (a.type !== b.type) return a.type === 'Payout' ? 1 : -1;
      return new Date(a.date) - new Date(b.date);
    });

    // Draw Activities Table
    doc.fillColor('#374151')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('LEDGER TRANSACTION JOURNAL', 40, 135);

    let currentY = 150;
    const rowHeight = 22;

    const drawTableHeaders = (y) => {
      doc.rect(40, y, doc.page.width - 80, rowHeight)
        .fillColor('#F3F4F6')
        .fill();

      doc.fillColor('#4B5563').fontSize(8.5).font('Helvetica-Bold');
      doc.text('Date', 50, y + 6);
      doc.text('Cycle', 125, y + 6);
      doc.text('Type', 170, y + 6);
      doc.text('Member / Beneficiary', 230, y + 6);
      doc.text('Method', 370, y + 6);
      doc.text('Amount (FCFA)', 445, y + 6, { width: 95, align: 'right' });
    };

    drawTableHeaders(currentY);
    currentY += rowHeight;

    transactions.forEach((tx) => {
      if (currentY > doc.page.height - 80) {
        doc.addPage();
        drawPageTemplate();
        currentY = 65;
        drawTableHeaders(currentY);
        currentY += rowHeight;
      }

      // Draw subtle row dividing lines
      doc.strokeColor('#F3F4F6')
        .lineWidth(0.5)
        .moveTo(40, currentY)
        .lineTo(doc.page.width - 40, currentY)
        .stroke();

      const { date } = this._formatDateTime(tx.date);
      
      // highlight payouts
      const isPayout = tx.type === 'Payout';
      const textCol = isPayout ? '#1E3A8A' : '#1F2937';
      const amountCol = isPayout ? '#B91C1C' : '#047857';

      doc.fillColor(textCol).fontSize(8).font(isPayout ? 'Helvetica-Bold' : 'Helvetica');
      doc.text(date, 50, currentY + 6);
      doc.text(`Cycle ${tx.cycleNumber}`, 125, currentY + 6);
      doc.text(tx.type, 170, currentY + 6);
      doc.text(tx.member, 230, currentY + 6, { width: 130, truncate: true });
      doc.text(tx.method, 370, currentY + 6);
      
      doc.fillColor(amountCol).font('Helvetica-Bold');
      doc.text(tx.amount, 445, currentY + 6, { width: 95, align: 'right' });

      currentY += rowHeight;
    });

    doc.strokeColor('#F3F4F6')
      .lineWidth(0.5)
      .moveTo(40, currentY)
      .lineTo(doc.page.width - 40, currentY)
      .stroke();

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Generate personal account statement.
   * @param {{ memberName, groupName, successRate, totalPaid }} memberData
   * @param {{ contributions: Array, payouts: Array }} history
   * @returns {Promise<Buffer>}
   */
  generatePersonalStatementPDF(memberData, history) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    const drawPageTemplate = () => {
      this._drawHeader(doc, 'Personal Account Statement', memberData.groupName);
      this._drawFooter(doc, 'Personal transaction statement generated by NjangiBridge. Keep for your archives.');
    };

    drawPageTemplate();

    // Summary Card
    const boxX = 40;
    const boxY = 65;
    const boxW = doc.page.width - 80;
    const boxH = 50;

    doc.roundedRect(boxX, boxY, boxW, boxH, 6)
      .fillColor('#F9FAFB')
      .fill();
    doc.roundedRect(boxX, boxY, boxW, boxH, 6)
      .strokeColor('#E5E7EB')
      .lineWidth(0.75)
      .stroke();

    const colW = boxW / 3;
    const summaryList = [
      { label: 'MEMBER NAME', val: memberData.memberName },
      { label: 'TOTAL CONTRIBUTIONS', val: `${memberData.totalPaid?.toLocaleString()} FCFA` },
      { label: 'ON-TIME SUCCESS RATE', val: `${memberData.successRate || 100}%` }
    ];

    summaryList.forEach((s, idx) => {
      const startColX = boxX + idx * colW;
      doc.fillColor('#6B7280').fontSize(7.5).font('Helvetica-Bold').text(s.label, startColX + 15, boxY + 12);
      doc.fillColor('#1F2937').fontSize(11).font('Helvetica-Bold').text(String(s.val), startColX + 15, boxY + 24, { width: colW - 20, truncate: true });

      if (idx < 2) {
        doc.strokeColor('#E5E7EB')
          .lineWidth(0.5)
          .moveTo(startColX + colW, boxY + 10)
          .lineTo(startColX + colW, boxY + boxH - 10)
          .stroke();
      }
    });

    // Compile activities list
    const transactions = [];
    (history.contributions || []).forEach((c) => {
      transactions.push({
        date: c.created_at || c.date,
        cycleNumber: c.cycles?.cycle_number || 1,
        type: 'Contribution',
        method: c.payment_method || 'momo',
        amount: `+ ${Number(c.amount).toLocaleString()} FCFA`,
        status: c.status
      });
    });
    (history.payouts || []).forEach((p) => {
      transactions.push({
        date: p.executed_at || p.created_at,
        cycleNumber: p.cycles?.cycle_number || 1,
        type: 'Payout Winner',
        method: p.delivery_method || 'momo',
        amount: `- ${Number(p.amount).toLocaleString()} FCFA`,
        status: p.status
      });
    });

    // Sort by date descending
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    doc.fillColor('#374151')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('PERSONAL TRANSACTION TRANSACTION JOURNAL', 40, 135);

    let currentY = 150;
    const rowHeight = 22;

    const drawTableHeaders = (y) => {
      doc.rect(40, y, doc.page.width - 80, rowHeight)
        .fillColor('#F3F4F6')
        .fill();

      doc.fillColor('#4B5563').fontSize(8.5).font('Helvetica-Bold');
      doc.text('Date', 50, y + 6);
      doc.text('Cycle', 150, y + 6);
      doc.text('Action Type', 210, y + 6);
      doc.text('Method', 310, y + 6);
      doc.text('Status', 390, y + 6);
      doc.text('Amount (FCFA)', 445, y + 6, { width: 95, align: 'right' });
    };

    drawTableHeaders(currentY);
    currentY += rowHeight;

    transactions.forEach((tx) => {
      if (currentY > doc.page.height - 80) {
        doc.addPage();
        drawPageTemplate();
        currentY = 65;
        drawTableHeaders(currentY);
        currentY += rowHeight;
      }

      doc.strokeColor('#F3F4F6')
        .lineWidth(0.5)
        .moveTo(40, currentY)
        .lineTo(doc.page.width - 40, currentY)
        .stroke();

      const { date } = this._formatDateTime(tx.date);
      const isPayout = tx.type.startsWith('Payout');
      const txTextCol = isPayout ? '#1E3A8A' : '#1F2937';
      const valCol = isPayout ? '#B91C1C' : '#047857';

      doc.fillColor(txTextCol).fontSize(8.5).font(isPayout ? 'Helvetica-Bold' : 'Helvetica');
      doc.text(date, 50, currentY + 6);
      doc.text(`Cycle ${tx.cycleNumber}`, 150, currentY + 6);
      doc.text(tx.type, 210, currentY + 6);
      doc.text(tx.method || 'momo', 310, currentY + 6);
      
      const statusLabel = tx.status || 'confirmed';
      doc.text(statusLabel.toUpperCase(), 390, currentY + 6);

      doc.fillColor(valCol).font('Helvetica-Bold');
      doc.text(tx.amount, 445, currentY + 6, { width: 95, align: 'right' });

      currentY += rowHeight;
    });

    doc.strokeColor('#F3F4F6')
      .lineWidth(0.5)
      .moveTo(40, currentY)
      .lineTo(doc.page.width - 40, currentY)
      .stroke();

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}

module.exports = new PDFService();
