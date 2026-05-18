// Hand-tuned line icons. 1.25 stroke, lucide-flavored but not slop.
const Icon = ({ d, size = 16, stroke = 1.5, fill = "none", style, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill={fill} stroke="currentColor" strokeWidth={stroke}
    strokeLinecap="round" strokeLinejoin="round" style={style}>
    {d ? <path d={d} /> : children}
  </svg>
);

const I = {
  home:    (p) => <Icon {...p} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />,
  jobs:    (p) => <Icon {...p}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></Icon>,
  events:  (p) => <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></Icon>,
  news:    (p) => <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></Icon>,
  shop:    (p) => <Icon {...p}><path d="M4 7h16l-1.5 11a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7z"/><path d="M9 7a3 3 0 0 1 6 0"/></Icon>,
  people:  (p) => <Icon {...p}><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M21 19c0-2.2-1.7-4-4-4"/></Icon>,
  benefits:(p) => <Icon {...p}><path d="M20 12v9H4v-9"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7s-3 0-4.5-1.5S6 2 7.5 2 12 4 12 7c0-3 3-5 4.5-5S18 4 16.5 5.5 12 7 12 7z"/></Icon>,
  pages:   (p) => <Icon {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></Icon>,
  bell:    (p) => <Icon {...p}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2.5h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/></Icon>,
  search:  (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Icon>,
  plus:    (p) => <Icon {...p} d="M12 5v14M5 12h14"/>,
  check:   (p) => <Icon {...p} d="m4 12 5 5L20 6"/>,
  arrow:   (p) => <Icon {...p} d="M5 12h14M13 5l7 7-7 7"/>,
  back:    (p) => <Icon {...p} d="M19 12H5M11 5l-7 7 7 7"/>,
  eye:     (p) => <Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></Icon>,
  edit:    (p) => <Icon {...p}><path d="M4 20h4l10-10-4-4L4 16z"/><path d="m14 6 4 4"/></Icon>,
  trash:   (p) => <Icon {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></Icon>,
  copy:    (p) => <Icon {...p}><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></Icon>,
  drag:    (p) => <Icon {...p}><circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/></Icon>,
  sparkle: (p) => <Icon {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></Icon>,
  map:     (p) => <Icon {...p}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/></Icon>,
  clock:   (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>,
  globe:   (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></Icon>,
  link:    (p) => <Icon {...p}><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></Icon>,
  upload:  (p) => <Icon {...p}><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M12 3v13M7 8l5-5 5 5"/></Icon>,
  star:    (p) => <Icon {...p} d="m12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.3 6.4 20.3l1.2-6.3L3 9.6l6.3-.8z" />,
  filter:  (p) => <Icon {...p} d="M3 5h18l-7 9v6l-4-2v-4z"/>,
  bold:    (p) => <Icon {...p}><path d="M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z"/></Icon>,
  italic:  (p) => <Icon {...p} d="M14 4h-5M15 20h-5M14 4 10 20"/>,
  list:    (p) => <Icon {...p} d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>,
  h1:      (p) => <Icon {...p} d="M4 6v12M12 6v12M4 12h8M16 9l3-2v11"/>,
  cmd:     (p) => <Icon {...p}><path d="M9 6a3 3 0 1 0-3 3h3V6zM15 6a3 3 0 1 1 3 3h-3V6zM9 18a3 3 0 1 1-3-3h3v3zM15 18a3 3 0 1 0 3-3h-3v3z"/><path d="M9 9h6v6H9z"/></Icon>,
  return:  (p) => <Icon {...p} d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"/>,
  warn:    (p) => <Icon {...p}><path d="M12 3 2 20h20z"/><path d="M12 10v5M12 18v.5"/></Icon>,
  lock:    (p) => <Icon {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></Icon>,
  spark2:  (p) => <Icon {...p} fill="currentColor" stroke="none" d="M12 2c.5 4 2.5 6 6.5 6.5-4 .5-6 2.5-6.5 6.5-.5-4-2.5-6-6.5-6.5C9.5 8 11.5 6 12 2zM19 14c.3 2 1.3 3 3 3.2-1.7.3-2.7 1.3-3 3.3-.3-2-1.3-3-3-3.3 1.7-.2 2.7-1.2 3-3.2z"/>,
  flag:    (p) => <Icon {...p}><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></Icon>,
  pin:     (p) => <Icon {...p}><path d="M12 2v6l4 4-4 1v9M8 12l4 1"/></Icon>,
  building:(p) => <Icon {...p}><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/></Icon>,
  doc:     (p) => <Icon {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></Icon>,
  chev:    (p) => <Icon {...p} d="m6 9 6 6 6-6"/>,
  chevR:   (p) => <Icon {...p} d="m9 6 6 6-6 6"/>,
};

window.I = I;
window.Icon = Icon;
