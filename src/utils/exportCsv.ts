export function exportToCsv(filename: string, columns: { label: string; key: string }[], data: any[]) {
  const escapeCsv = (v: any) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (s.includes(',') || s.includes('\n') || s.includes('"')) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }

  const header = columns.map(c => c.label).join(',')
  const rows = data.map(row => columns.map(col => {
    // support nested keys like 'customer.name'
    const keys = col.key.split('.')
    let val: any = row
    for (const k of keys) {
      if (val == null) break
      val = val[k]
    }
    return escapeCsv(val)
  }).join(',')).join('\n')

  const csv = header + '\n' + rows
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default exportToCsv
