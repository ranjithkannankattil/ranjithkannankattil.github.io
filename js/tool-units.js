/* ============================================================
   TOOL — Oil & gas unit converter  (productivity/units.html)
   Every group has one base unit; each unit is a factor to it
   (value_in_base = value × f + off). Groups that cross from mass
   to gas volume or energy compute their factors from the
   assumptions panel. Temperature and °API are non-linear, so
   their units carry to/from functions instead.
   ============================================================ */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k) { try { return localStorage.getItem('uc:' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('uc:' + k, v); } catch (e) { /* private mode */ } }
  };

  // ---------- assumptions ----------
  var DEF = { rhoL: 450, rhoS: 0.74, ghv: 54.5, cargo: 174000, days: 365, atm: 1.01325 };
  var PRESETS = [
    { name: 'Typical LNG', v: { rhoL: 450, rhoS: 0.74, ghv: 54.5 } },
    { name: 'Lean LNG', v: { rhoL: 430, rhoS: 0.70, ghv: 55.0 } },
    { name: 'Rich LNG', v: { rhoL: 470, rhoS: 0.79, ghv: 53.8 } },
    { name: 'Pure methane', v: { rhoL: 422.6, rhoS: 0.6785, ghv: 55.5 } }
  ];
  var P = Object.assign({}, DEF);
  try { Object.assign(P, JSON.parse(store.get('p') || '{}')); } catch (e) { /* keep defaults */ }

  // physical constants
  var BTU = 1055.05585262;            // J, International Table
  var BBL = 0.158987294928;           // m³
  var GAL = 0.003785411784;           // m³, US
  var FT3 = 0.028316846592;           // m³
  var PSI = 6894.757293168;           // Pa
  var LB = 0.45359237;                // kg
  var WATER60 = 999.016;              // kg/m³ at 60 °F
  var T15 = 288.15, T0 = 273.15, T60F = 288.7055556;
  var DAY = 86400;

  // gas volume → kg, from the gas density at 15 °C (ideal gas between reference states)
  function kgPerSm3() { return P.rhoS; }
  function kgPerNm3() { return P.rhoS * T15 / T0; }
  function kgPerScf() { return P.rhoS * FT3 * (T15 / T60F) * (101325.353 / 101325); } // 14.696 psia = 101325.35 Pa
  function kgPerGJ() { return 1000 / P.ghv; }         // GHV in MJ/kg
  function year() { return P.days * DAY; }

  // ---------- groups ----------
  // f: factor to base (number or function of P). uses: which assumptions matter.
  function lngUnits(rate) {
    var u = function (id, label, desc, kg, per) {
      if (kg === undefined) kg = 1;
      return { id: id, label: label, desc: desc, f: function () { return (typeof kg === 'function' ? kg() : kg) / (rate ? (typeof per === 'function' ? per() : per) : 1); } };
    };
    if (!rate) return [
      u('kg', 'kg', 'kilogram'), u('t', 't', 'tonne', 1000), u('kt', 'kt', 'thousand tonnes', 1e6), u('Mt', 'Mt', 'million tonnes', 1e9),
      u('m3lng', 'm³ LNG', 'cubic metre of liquid', function () { return P.rhoL; }),
      u('cargo', 'cargo', 'standard cargo', function () { return P.rhoL * P.cargo; }),
      u('Sm3', 'Sm³', 'standard cubic metre of gas', kgPerSm3), u('MMSm3', 'MMSm³', 'million Sm³', function () { return 1e6 * kgPerSm3(); }),
      u('bcm', 'bcm', 'billion Sm³', function () { return 1e9 * kgPerSm3(); }),
      u('Nm3', 'Nm³', 'normal cubic metre (0 °C)', kgPerNm3),
      u('scf', 'scf', 'standard cubic foot', kgPerScf), u('Mscf', 'Mscf', 'thousand scf', function () { return 1e3 * kgPerScf(); }),
      u('MMscf', 'MMscf', 'million scf', function () { return 1e6 * kgPerScf(); }), u('Bcf', 'Bcf', 'billion scf', function () { return 1e9 * kgPerScf(); }),
      u('Tcf', 'Tcf', 'trillion scf', function () { return 1e12 * kgPerScf(); }),
      u('GJ', 'GJ', 'gigajoule (HHV)', kgPerGJ), u('TJ', 'TJ', 'terajoule (HHV)', function () { return 1000 * kgPerGJ(); }),
      u('MMBtu', 'MMBtu', 'million Btu (HHV)', function () { return BTU * 1e6 / 1e9 * kgPerGJ(); }),
      u('therm', 'therm', '100,000 Btu', function () { return BTU * 1e5 / 1e9 * kgPerGJ(); }),
      u('MWh', 'MWh', 'megawatt-hour (thermal)', function () { return 3.6 * kgPerGJ(); }),
      u('GWh', 'GWh', 'gigawatt-hour (thermal)', function () { return 3600 * kgPerGJ(); }),
      u('boe', 'boe', 'barrel of oil equivalent (5.8 MMBtu)', function () { return 5.8 * BTU * 1e6 / 1e9 * kgPerGJ(); })
    ];
    var yr = year, d = DAY, h = 3600;
    return [
      u('MTPA', 'MTPA', 'million tonnes per year', 1e9, yr), u('ktpa', 'kt/yr', 'thousand tonnes per year', 1e6, yr),
      u('tpd', 't/d', 'tonnes per day', 1000, d), u('tph', 't/h', 'tonnes per hour', 1000, h), u('kgs', 'kg/s', 'kilograms per second', 1, 1),
      u('m3lngh', 'm³ LNG/h', 'liquid per hour', function () { return P.rhoL; }, h), u('m3lngd', 'm³ LNG/d', 'liquid per day', function () { return P.rhoL; }, d),
      u('cargoyr', 'cargoes/yr', 'standard cargoes per year', function () { return P.rhoL * P.cargo; }, yr),
      u('MMscfd', 'MMscfd', 'million scf per day', function () { return 1e6 * kgPerScf(); }, d),
      u('Bcfd', 'Bcf/d', 'billion scf per day', function () { return 1e9 * kgPerScf(); }, d),
      u('Bcfyr', 'Bcf/yr', 'billion scf per year', function () { return 1e9 * kgPerScf(); }, yr),
      u('MMSm3d', 'MMSm³/d', 'million Sm³ per day', function () { return 1e6 * kgPerSm3(); }, d),
      u('Sm3h', 'Sm³/h', 'Sm³ per hour', kgPerSm3, h), u('Nm3h', 'Nm³/h', 'Nm³ per hour', kgPerNm3, h),
      u('bcmyr', 'bcm/yr', 'billion Sm³ per year', function () { return 1e9 * kgPerSm3(); }, yr),
      u('MMBtud', 'MMBtu/d', 'million Btu per day (HHV)', function () { return BTU * 1e-3 * kgPerGJ(); }, d),
      u('MMBtuh', 'MMBtu/h', 'million Btu per hour (HHV)', function () { return BTU * 1e-3 * kgPerGJ(); }, h),
      u('GJd', 'GJ/d', 'gigajoules per day', kgPerGJ, d),
      u('MWth', 'MW', 'megawatts thermal (HHV)', function () { return 1e-3 * kgPerGJ(); }, 1)
    ];
  }

  var GROUPS = [
    { id: 'lng', name: 'LNG & gas', uses: ['lng'],
      note: 'Quantities. Mass, liquid volume, gas volume and energy are linked by the assumptions.', units: lngUnits(false), defUnit: 'Mt' },
    { id: 'lngrate', name: 'LNG & gas rates', uses: ['lng', 'year'], defUnit: 'MTPA', defVal: '18.6',
      note: 'Rates. Per-year figures use the days in a year under Assumptions (365 for nameplate; fewer for stream days).', units: lngUnits(true) },
    { id: 'vol', name: 'Volume', defUnit: 'bbl', units: [
      { id: 'm3', label: 'm³', desc: 'cubic metre', f: 1 }, { id: 'L', label: 'L', desc: 'litre', f: 1e-3 },
      { id: 'bbl', label: 'bbl', desc: 'oil barrel (42 US gal)', f: BBL }, { id: 'kbbl', label: 'kbbl', desc: 'thousand barrels', f: BBL * 1e3 },
      { id: 'MMbbl', label: 'MMbbl', desc: 'million barrels', f: BBL * 1e6 }, { id: 'galus', label: 'US gal', desc: 'US gallon', f: GAL },
      { id: 'galuk', label: 'imp gal', desc: 'imperial gallon', f: 0.00454609 }, { id: 'ft3', label: 'ft³', desc: 'cubic foot', f: FT3 },
      { id: 'kft3', label: 'Mcf', desc: 'thousand cubic feet', f: FT3 * 1e3 }, { id: 'acft', label: 'acre-ft', desc: 'acre-foot', f: 1233.48183754752 },
      { id: 'cm3', label: 'cm³', desc: 'cubic centimetre (mL)', f: 1e-6 }
    ] },
    { id: 'liq', name: 'Liquid flow', uses: ['year'], defUnit: 'bpd', units: [
      { id: 'bpd', label: 'bbl/d', desc: 'barrels per day (bpd)', f: BBL / DAY }, { id: 'kbpd', label: 'kbbl/d', desc: 'thousand barrels per day', f: BBL * 1e3 / DAY },
      { id: 'MMbblyr', label: 'MMbbl/yr', desc: 'million barrels per year', f: function () { return BBL * 1e6 / year(); } },
      { id: 'bph', label: 'bbl/h', desc: 'barrels per hour', f: BBL / 3600 },
      { id: 'm3d', label: 'm³/d', desc: 'cubic metres per day', f: 1 / DAY }, { id: 'm3h', label: 'm³/h', desc: 'cubic metres per hour', f: 1 / 3600 },
      { id: 'm3s', label: 'm³/s', desc: 'cubic metres per second', f: 1 }, { id: 'Ls', label: 'L/s', desc: 'litres per second', f: 1e-3 },
      { id: 'Lmin', label: 'L/min', desc: 'litres per minute', f: 1e-3 / 60 }, { id: 'gpm', label: 'US gpm', desc: 'US gallons per minute', f: GAL / 60 },
      { id: 'igpm', label: 'imp gpm', desc: 'imperial gallons per minute', f: 0.00454609 / 60 }, { id: 'cfs', label: 'ft³/s', desc: 'cubic feet per second', f: FT3 }
    ] },
    { id: 'mass', name: 'Mass', defUnit: 't', units: [
      { id: 'kg', label: 'kg', desc: 'kilogram', f: 1 }, { id: 'g', label: 'g', desc: 'gram', f: 1e-3 }, { id: 't', label: 't', desc: 'tonne (metric)', f: 1000 },
      { id: 'kt', label: 'kt', desc: 'thousand tonnes', f: 1e6 }, { id: 'Mt', label: 'Mt', desc: 'million tonnes', f: 1e9 },
      { id: 'lb', label: 'lb', desc: 'pound', f: LB }, { id: 'klb', label: 'klb', desc: 'thousand pounds (kip)', f: LB * 1e3 },
      { id: 'sht', label: 'short ton', desc: '2,000 lb (US ton)', f: LB * 2000 }, { id: 'lgt', label: 'long ton', desc: '2,240 lb (UK ton)', f: LB * 2240 },
      { id: 'oz', label: 'oz', desc: 'ounce', f: LB / 16 }
    ] },
    { id: 'mflow', name: 'Mass flow', uses: ['year'], defUnit: 'tph', units: [
      { id: 'kgs', label: 'kg/s', desc: 'kilograms per second', f: 1 }, { id: 'kgh', label: 'kg/h', desc: 'kilograms per hour', f: 1 / 3600 },
      { id: 'tph', label: 't/h', desc: 'tonnes per hour', f: 1000 / 3600 }, { id: 'tpd', label: 't/d', desc: 'tonnes per day', f: 1000 / DAY },
      { id: 'ktpa', label: 'kt/yr', desc: 'thousand tonnes per year', f: function () { return 1e6 / year(); } },
      { id: 'MTPA', label: 'MTPA', desc: 'million tonnes per year', f: function () { return 1e9 / year(); } },
      { id: 'lbh', label: 'lb/h', desc: 'pounds per hour', f: LB / 3600 }, { id: 'lbs', label: 'lb/s', desc: 'pounds per second', f: LB }
    ] },
    { id: 'pressure', name: 'Pressure', uses: ['pressure'], defUnit: 'psig', units: [
      { id: 'bara', label: 'bara', desc: 'bar absolute', f: 1e5 },
      { id: 'barg', label: 'barg', desc: 'bar gauge', f: 1e5, off: function () { return P.atm * 1e5; } },
      { id: 'psia', label: 'psia', desc: 'pounds per square inch, absolute', f: PSI },
      { id: 'psig', label: 'psig', desc: 'pounds per square inch, gauge', f: PSI, off: function () { return P.atm * 1e5; } },
      { id: 'kPa', label: 'kPa(a)', desc: 'kilopascal absolute', f: 1e3 }, { id: 'kPag', label: 'kPa(g)', desc: 'kilopascal gauge', f: 1e3, off: function () { return P.atm * 1e5; } },
      { id: 'MPa', label: 'MPa(a)', desc: 'megapascal absolute', f: 1e6 }, { id: 'MPag', label: 'MPa(g)', desc: 'megapascal gauge', f: 1e6, off: function () { return P.atm * 1e5; } },
      { id: 'Pa', label: 'Pa', desc: 'pascal absolute', f: 1 }, { id: 'mbar', label: 'mbar(a)', desc: 'millibar absolute', f: 100 },
      { id: 'atm', label: 'atm', desc: 'standard atmosphere', f: 101325 },
      { id: 'kgcm2', label: 'kg/cm²(a)', desc: 'kilogram-force per cm², absolute', f: 98066.5 },
      { id: 'kgcm2g', label: 'kg/cm²(g)', desc: 'kilogram-force per cm², gauge', f: 98066.5, off: function () { return P.atm * 1e5; } },
      { id: 'ksi', label: 'ksi', desc: 'thousand psi (stress)', f: PSI * 1e3 },
      { id: 'mmHg', label: 'mmHg', desc: 'millimetre of mercury (torr)', f: 133.322387415 },
      { id: 'inH2O', label: 'inH₂O', desc: 'inch of water (4 °C)', f: 249.08891 }, { id: 'mH2O', label: 'mH₂O', desc: 'metre of water (4 °C)', f: 9806.65 }
    ] },
    { id: 'temp', name: 'Temperature', defUnit: 'C', defVal: '-162', units: [
      { id: 'C', label: '°C', desc: 'Celsius', to: function (v) { return v + 273.15; }, from: function (k) { return k - 273.15; } },
      { id: 'F', label: '°F', desc: 'Fahrenheit', to: function (v) { return (v - 32) * 5 / 9 + 273.15; }, from: function (k) { return (k - 273.15) * 9 / 5 + 32; } },
      { id: 'K', label: 'K', desc: 'kelvin', to: function (v) { return v; }, from: function (k) { return k; } },
      { id: 'R', label: '°R', desc: 'Rankine', to: function (v) { return v * 5 / 9; }, from: function (k) { return k * 9 / 5; } }
    ] },
    { id: 'energy', name: 'Energy', defUnit: 'MMBtu', units: [
      { id: 'J', label: 'J', desc: 'joule', f: 1 }, { id: 'kJ', label: 'kJ', desc: 'kilojoule', f: 1e3 }, { id: 'MJ', label: 'MJ', desc: 'megajoule', f: 1e6 },
      { id: 'GJ', label: 'GJ', desc: 'gigajoule', f: 1e9 }, { id: 'TJ', label: 'TJ', desc: 'terajoule', f: 1e12 }, { id: 'PJ', label: 'PJ', desc: 'petajoule', f: 1e15 },
      { id: 'kWh', label: 'kWh', desc: 'kilowatt-hour', f: 3.6e6 }, { id: 'MWh', label: 'MWh', desc: 'megawatt-hour', f: 3.6e9 },
      { id: 'GWh', label: 'GWh', desc: 'gigawatt-hour', f: 3.6e12 }, { id: 'TWh', label: 'TWh', desc: 'terawatt-hour', f: 3.6e15 },
      { id: 'Btu', label: 'Btu', desc: 'British thermal unit (IT)', f: BTU }, { id: 'MMBtu', label: 'MMBtu', desc: 'million Btu (= dekatherm)', f: BTU * 1e6 },
      { id: 'therm', label: 'therm', desc: '100,000 Btu', f: BTU * 1e5 }, { id: 'quad', label: 'quad', desc: '10¹⁵ Btu', f: BTU * 1e15 },
      { id: 'kcal', label: 'kcal', desc: 'kilocalorie (IT)', f: 4186.8 }, { id: 'Gcal', label: 'Gcal', desc: 'gigacalorie (IT)', f: 4.1868e9 },
      { id: 'boe', label: 'boe', desc: 'barrel of oil equivalent (5.8 MMBtu)', f: BTU * 5.8e6 },
      { id: 'toe', label: 'toe', desc: 'tonne of oil equivalent (41.868 GJ)', f: 41.868e9 }
    ] },
    { id: 'power', name: 'Power', defUnit: 'MW', units: [
      { id: 'W', label: 'W', desc: 'watt', f: 1 }, { id: 'kW', label: 'kW', desc: 'kilowatt', f: 1e3 }, { id: 'MW', label: 'MW', desc: 'megawatt', f: 1e6 },
      { id: 'GW', label: 'GW', desc: 'gigawatt', f: 1e9 }, { id: 'hp', label: 'hp', desc: 'mechanical horsepower', f: 745.69987158227 },
      { id: 'PS', label: 'PS', desc: 'metric horsepower', f: 735.49875 }, { id: 'Btuh', label: 'Btu/h', desc: 'Btu per hour', f: BTU / 3600 },
      { id: 'MMBtuh', label: 'MMBtu/h', desc: 'million Btu per hour', f: BTU * 1e6 / 3600 }, { id: 'kcalh', label: 'kcal/h', desc: 'kilocalories per hour', f: 4186.8 / 3600 },
      { id: 'GJh', label: 'GJ/h', desc: 'gigajoules per hour', f: 1e9 / 3600 }, { id: 'TR', label: 'TR', desc: 'ton of refrigeration', f: 3516.8528420667 }
    ] },
    { id: 'density', name: 'Density & °API', defUnit: 'API', defVal: '35', units: [
      { id: 'kgm3', label: 'kg/m³', desc: 'kilograms per cubic metre', f: 1 }, { id: 'gcm3', label: 'g/cm³', desc: 'grams per cm³ (kg/L)', f: 1000 },
      { id: 'lbft3', label: 'lb/ft³', desc: 'pounds per cubic foot', f: LB / FT3 }, { id: 'lbgal', label: 'lb/US gal', desc: 'pounds per US gallon (ppg)', f: LB / GAL },
      { id: 'lbbbl', label: 'lb/bbl', desc: 'pounds per barrel', f: LB / BBL }, { id: 'tbbl', label: 'bbl/t', desc: 'barrels per tonne', inv: true, f: 1000 / BBL },
      { id: 'SG', label: 'SG', desc: 'specific gravity, 60/60 °F', f: WATER60 },
      { id: 'API', label: '°API', desc: 'API gravity', to: function (v) { return 141.5 / (v + 131.5) * WATER60; }, from: function (k) { return 141.5 / (k / WATER60) - 131.5; } }
    ] },
    { id: 'length', name: 'Length', defUnit: 'ft', units: [
      { id: 'mm', label: 'mm', desc: 'millimetre', f: 1e-3 }, { id: 'cm', label: 'cm', desc: 'centimetre', f: 1e-2 }, { id: 'm', label: 'm', desc: 'metre', f: 1 },
      { id: 'km', label: 'km', desc: 'kilometre', f: 1e3 }, { id: 'in', label: 'in', desc: 'inch', f: 0.0254 }, { id: 'ft', label: 'ft', desc: 'foot', f: 0.3048 },
      { id: 'yd', label: 'yd', desc: 'yard', f: 0.9144 }, { id: 'mi', label: 'mile', desc: 'statute mile', f: 1609.344 }, { id: 'nmi', label: 'nmi', desc: 'nautical mile', f: 1852 }
    ] },
    { id: 'area', name: 'Area', defUnit: 'ha', units: [
      { id: 'm2', label: 'm²', desc: 'square metre', f: 1 }, { id: 'ha', label: 'ha', desc: 'hectare', f: 1e4 }, { id: 'km2', label: 'km²', desc: 'square kilometre', f: 1e6 },
      { id: 'ft2', label: 'ft²', desc: 'square foot', f: 0.09290304 }, { id: 'acre', label: 'acre', desc: 'international acre', f: 4046.8564224 },
      { id: 'mi2', label: 'mi²', desc: 'square mile', f: 2589988.110336 }, { id: 'in2', label: 'in²', desc: 'square inch', f: 0.00064516 }
    ] }
  ];

  var val = function (f) { return typeof f === 'function' ? f() : f; };
  function toBase(u, v) {
    if (u.to) return u.to(v);
    if (u.inv) return val(u.f) / v;
    return v * val(u.f) + (u.off ? val(u.off) : 0);
  }
  function fromBase(u, b) {
    if (u.from) return u.from(b);
    if (u.inv) return val(u.f) / b;
    return (b - (u.off ? val(u.off) : 0)) / val(u.f);
  }

  // ---------- number in / out ----------
  function parse(s) {
    s = String(s).trim();
    if (!s) return NaN;
    if (fmt.sep === 'euro') s = s.replace(/\./g, '').replace(/,/g, '.');
    else s = s.replace(/[,\s_](?=\d{3}(\D|$))/g, '').replace(/,/g, '.');
    s = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\^/g, '**');
    if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return parseFloat(s);
    if (!/^[\d.eE+\-*/()\s]+$/.test(s) || /[a-df-zA-DF-Z]/.test(s)) return NaN;
    try { var r = Function('"use strict";return (' + s + ')')(); return typeof r === 'number' ? r : NaN; } catch (e) { return NaN; }
  }
  var fmt = { sig: 6, sep: 'comma' };
  function show(x) {
    if (!isFinite(x)) return '—';
    if (x === 0) return '0';
    var a = Math.abs(x);
    var s;
    if (a >= 1e15 || a < 1e-6) {
      s = x.toExponential(Math.max(0, fmt.sig - 1)).replace(/\.?0+e/, 'e');
      var m = s.split('e');
      s = m[0] + ' × 10' + sup(m[1].replace('+', ''));
      return fmt.sep === 'euro' ? s.replace('.', ',') : s;
    }
    var r = Number(x.toPrecision(fmt.sig));
    var dec = Math.max(0, fmt.sig - 1 - Math.floor(Math.log10(Math.abs(r))));
    s = r.toFixed(Math.min(dec, 20)).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    var parts = s.split('.'), g = { comma: ',', space: ' ', none: '', euro: '.' }[fmt.sep];
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, g);
    return parts.join(fmt.sep === 'euro' ? ',' : '.');
  }
  function sup(n) { return String(n).replace(/[-0-9]/g, function (c) { return '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]; }); }
  function plain(x) { return isFinite(x) ? String(Number(x.toPrecision(fmt.sig))) : ''; }

  // ---------- state ----------
  var S = { g: 'lngrate', u: 'MTPA', v: '18.6' };
  try { Object.assign(S, JSON.parse(store.get('s') || '{}')); } catch (e) { /* defaults */ }
  fmt.sig = +(store.get('sig') || 6); fmt.sep = store.get('sep') || 'comma';
  // a shared link wins: #g=lngrate&u=MTPA&v=18.6 (+ optional assumptions)
  (function readHash() {
    var h = new URLSearchParams(location.hash.slice(1));
    if (h.get('g')) { S.g = h.get('g'); S.u = h.get('u') || ''; S.v = h.get('v') || '1'; }
    ['rhoL', 'rhoS', 'ghv', 'cargo', 'days', 'atm'].forEach(function (k) { var x = parseFloat(h.get(k)); if (isFinite(x) && x > 0) P[k] = x; });
  })();
  var group = function () { return GROUPS.filter(function (g) { return g.id === S.g; })[0] || GROUPS[0]; };
  var unitOf = function (g, id) { return g.units.filter(function (u) { return u.id === id; })[0]; };

  // ---------- render ----------
  var cats = $('cats'), sel = $('unit'), inp = $('val'), list = $('list');
  cats.innerHTML = GROUPS.map(function (g) {
    return '<button type="button" data-g="' + g.id + '">' + g.name + '</button>';
  }).join('');
  cats.addEventListener('click', function (e) {
    var b = e.target.closest('[data-g]'); if (!b) return;
    if (b.dataset.g === S.g) return;
    var g = GROUPS.filter(function (x) { return x.id === b.dataset.g; })[0];
    S.g = g.id; S.u = g.defUnit; S.v = g.defVal || '1';
    setGroup(); b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });

  function setGroup() {
    var g = group();
    if (!unitOf(g, S.u)) S.u = g.defUnit;
    cats.querySelectorAll('button').forEach(function (b) { var on = b.dataset.g === g.id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    sel.innerHTML = g.units.map(function (u) { return '<option value="' + u.id + '">' + u.label + ' — ' + u.desc + '</option>'; }).join('');
    sel.value = S.u;
    inp.value = S.v;
    var uses = g.uses || [];
    document.querySelectorAll('#assume [data-for]').forEach(function (r) { r.hidden = uses.indexOf(r.dataset.for) < 0; });
    $('presets').hidden = uses.indexOf('lng') < 0;
    $('derived').hidden = uses.indexOf('lng') < 0;
    $('assume').hidden = !uses.length;
    $('hint').textContent = g.note || '';
    calc();
  }

  function calc() {
    var g = group(), from = unitOf(g, S.u), v = parse(inp.value);
    S.v = inp.value; save();
    var err = $('valErr');
    if (inp.value.trim() && !isFinite(v)) { err.textContent = 'That doesn’t read as a number.'; inp.setAttribute('aria-invalid', 'true'); }
    else { err.textContent = ''; inp.removeAttribute('aria-invalid'); }
    var b = isFinite(v) ? toBase(from, v) : NaN;
    var warn = '';
    if (g.id === 'temp' && b < 0) warn = 'Below absolute zero.';
    if (g.id === 'pressure' && b < 0) warn = 'Below a perfect vacuum — check gauge vs absolute.';
    if (warn) err.textContent = warn;
    list.innerHTML = g.units.map(function (u) {
      var x = isFinite(b) ? fromBase(u, b) : NaN;
      return '<li' + (u.id === from.id ? ' class="cur"' : '') + '>' +
        '<button type="button" class="uc-pick" data-u="' + u.id + '" data-x="' + plain(x) + '" title="Start from ' + u.label + '">' +
        '<span class="n">' + show(x) + '</span><span class="u">' + u.label + '</span><span class="d">' + u.desc + '</span></button>' +
        '<button type="button" class="uc-copy" data-copy="' + plain(x) + '" aria-label="Copy ' + u.label + ' value">Copy</button></li>';
    }).join('');
    derived();
  }

  function derived() {
    var d = $('derived'); if (d.hidden) return;
    var exp = P.rhoL / P.rhoS;
    var mmbtuT = P.ghv * 1e9 / (BTU * 1e6);
    var mtpa = 1e9 / year() / (1e6 * kgPerScf()) * DAY;
    d.innerHTML = 'With these: 1 m³ LNG → <b>' + show(exp) + '</b> Sm³ gas · 1 t LNG → <b>' + show(mmbtuT) + '</b> MMBtu · 1 MTPA → <b>' + show(mtpa) + '</b> MMscfd · ' +
      'gas heating value <b>' + show(P.ghv * P.rhoS) + '</b> MJ/Sm³ (' + show(P.ghv * kgPerScf() * 1e6 / BTU) + ' Btu/scf).';
  }

  list.addEventListener('click', function (e) {
    var c = e.target.closest('[data-copy]');
    if (c) { copy(c.dataset.copy, c); return; }
    var p = e.target.closest('[data-u]');
    if (p && p.dataset.x) { S.u = p.dataset.u; S.v = p.dataset.x; sel.value = S.u; inp.value = S.v; calc(); inp.focus(); inp.select(); }
  });
  sel.addEventListener('change', function () {
    // keep the same quantity, shown in the new unit
    var g = group(), v = parse(inp.value), old = unitOf(g, S.u), nu = unitOf(g, sel.value);
    if (isFinite(v)) inp.value = plain(fromBase(nu, toBase(old, v)));
    S.u = sel.value; calc();
  });
  inp.addEventListener('input', calc);
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { var v = parse(inp.value); if (isFinite(v)) { inp.value = plain(v); calc(); } }
  });

  // ---------- assumptions ----------
  var PIN = { rhoL: 'pRhoL', rhoS: 'pRhoS', ghv: 'pGhv', cargo: 'pCargo', days: 'pDays', atm: 'pAtm' };
  function fillAssume() { Object.keys(PIN).forEach(function (k) { $(PIN[k]).value = P[k]; }); markPreset(); }
  Object.keys(PIN).forEach(function (k) {
    $(PIN[k]).addEventListener('input', function () {
      var x = parseFloat(this.value);
      if (isFinite(x) && x > 0) { P[k] = x; store.set('p', JSON.stringify(P)); markPreset(); calc(); }
    });
  });
  $('presets').innerHTML = PRESETS.map(function (p, i) { return '<button type="button" data-p="' + i + '">' + p.name + '</button>'; }).join('');
  $('presets').addEventListener('click', function (e) {
    var b = e.target.closest('[data-p]'); if (!b) return;
    Object.assign(P, PRESETS[+b.dataset.p].v); store.set('p', JSON.stringify(P)); fillAssume(); calc();
  });
  function markPreset() {
    $('presets').querySelectorAll('button').forEach(function (b) {
      var v = PRESETS[+b.dataset.p].v;
      b.classList.toggle('on', Object.keys(v).every(function (k) { return P[k] === v[k]; }));
    });
  }
  $('assumeReset').addEventListener('click', function () { P = Object.assign({}, DEF); store.set('p', JSON.stringify(P)); fillAssume(); calc(); });

  // ---------- display + sharing ----------
  $('sig').value = String(fmt.sig); $('sep').value = fmt.sep;
  $('sig').addEventListener('change', function () { fmt.sig = +this.value; store.set('sig', this.value); calc(); });
  $('sep').addEventListener('change', function () { fmt.sep = this.value; store.set('sep', this.value); calc(); });

  function copy(text, btn) {
    var done = function () { if (!btn) return; var t = btn.textContent; btn.textContent = 'Copied'; btn.classList.add('ok'); setTimeout(function () { btn.textContent = t; btn.classList.remove('ok'); }, 1400); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
    else { fallback(text); done(); }
  }
  function fallback(text) { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) { /* nothing */ } t.remove(); }

  $('shareBtn').addEventListener('click', function () {
    var g = group(), h = new URLSearchParams({ g: g.id, u: S.u, v: String(parse(inp.value)) });
    (g.uses || []).forEach(function (use) {
      var ks = use === 'lng' ? ['rhoL', 'rhoS', 'ghv', 'cargo'] : use === 'year' ? ['days'] : ['atm'];
      ks.forEach(function (k) { if (P[k] !== DEF[k]) h.set(k, P[k]); });
    });
    copy(location.origin + location.pathname + '#' + h.toString(), this);
  });
  $('copyAll').addEventListener('click', function () {
    var g = group(), v = parse(inp.value), from = unitOf(g, S.u);
    if (!isFinite(v)) return;
    var b = toBase(from, v);
    var lines = g.units.map(function (u) { return show(fromBase(u, b)) + ' ' + u.label; });
    var head = show(v) + ' ' + from.label + ' =';
    var foot = (g.uses || []).indexOf('lng') >= 0 ? '\n(LNG ' + P.rhoL + ' kg/m³, gas ' + P.rhoS + ' kg/Sm³, HHV ' + P.ghv + ' MJ/kg' + ((g.uses || []).indexOf('year') >= 0 ? ', ' + P.days + ' d/yr' : '') + ')' : '';
    copy(head + '\n' + lines.join('\n') + foot, this);
  });

  function save() { store.set('s', JSON.stringify(S)); }

  fillAssume();
  setGroup();
})();
