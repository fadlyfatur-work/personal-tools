import { ahspTypeLabel, type AhspSearchStats, type AhspTypeCount } from '@/lib/ahsp'
import styles from './catalog.module.css'

const number = new Intl.NumberFormat('id-ID')
export default function SearchSummary({ stats, total, types }: { stats: AhspSearchStats; total: number; types: AhspTypeCount[] }) {
  return <section className={styles.searchSummary} aria-label="Ringkasan pencarian">
    <p><strong>{number.format(total)} item unik ditemukan</strong><span>{stats.found_terms} dari {stats.input_count} istilah memiliki hasil pada {stats.match === 'exact' ? 'Exact-match' : 'Like-match'}.</span></p>
    <p className={styles.summaryComparison}>Exact-match: <strong>{number.format(stats.exact_total)}</strong> item dari {number.format(stats.filtered_catalog_total)} item dalam cakupan filter. {stats.exact_found_terms} dari {stats.input_count} istilah cocok persis.</p>
    <details className={styles.termDetails} open={stats.input_count === 1}>
      <summary>Kecocokan per istilah ({stats.input_count})</summary>
      <div className={styles.termTable}>
        <table><caption>Jumlah item pekerjaan untuk setiap istilah pencarian</caption><thead><tr><th scope="col">Istilah</th><th scope="col" data-active={stats.match === 'exact'}>Exact-match</th><th scope="col" data-active={stats.match === 'like'}>Like-match</th></tr></thead><tbody>{stats.terms.map(term => <tr key={term.term}><th scope="row">{term.term}</th><td data-active={stats.match === 'exact'}>{number.format(term.exact_count)}</td><td data-active={stats.match === 'like'}>{number.format(term.like_count)}</td></tr>)}</tbody></table>
      </div>
      <p className={styles.help}>Total menghitung item pekerjaan unik; satu item bisa cocok dengan beberapa istilah.</p>
    </details>
    {!!types.length && <p className={styles.typeCounts}>Jenis hasil: {types.map(type => `${ahspTypeLabel(type.type)} ${number.format(type.count)}`).join(' · ')}</p>}
  </section>
}
