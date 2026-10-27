import json, sys, os
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
from shapely import STRtree, make_valid
src=sys.argv[1]; out=sys.argv[2]
os.makedirs(out+'/a1',exist_ok=True)
C=json.load(open(src+'/ne_10m_admin_0_countries_ind.geojson'))['features']
def altstr(name,vals):
    out=[]
    for v in vals:
        if not v or v in ('-99','-1'): continue
        for x in str(v).split('|'):
            x=x.strip()
            if x and x.lower()!=name.lower() and x not in out: out.append(x)
    return '|'.join(out)
countries=[]
for f in C:
    p=f['properties']; g=make_valid(shape(f['geometry']))
    cid=p['ADM0_A3_IN'] if p.get('ADM0_A3_IN') and p['ADM0_A3_IN']!='-99' else p['ADM0_A3']
    nm=p.get('NAME_EN') or p['NAME']
    alts=[p.get(k) for k in ('NAME','NAME_LONG','FORMAL_EN','NAME_ALT','BRK_NAME','NAME_SORT','NAME_CIAWF','ISO_A2_EH','ISO_A3_EH','ISO_A2','ISO_A3','ABBREV')]
    countries.append(dict(id=cid,name=nm,alt=alts,g=g))
ids=[c['id'] for c in countries]; assert len(ids)==len(set(ids)),[i for i in ids if ids.count(i)>1]
# world file
json.dump({'type':'FeatureCollection','features':[{'type':'Feature','properties':{'id':c['id'],'name':c['name'],'alt':altstr(c['name'],c['alt'])},'geometry':mapping(c['g'])} for c in countries]},open(out+'/world.geojson','w'))
tree=STRtree([c['g'] for c in countries])
A=json.load(open(src+'/ne_10m_admin_1_states_provinces.geojson'))['features']
by={}
for f in A:
    p=f['properties']; g=make_valid(shape(f['geometry']))
    pt=g.representative_point()
    hits=[i for i in tree.query(pt) if countries[i]['g'].covers(pt)]
    if not hits:
        hits=[int(tree.nearest(pt))]
    ci=hits[0]
    hasc=(p.get('code_hasc') or '').split('.')[-1]
    by.setdefault(ci,[]).append(dict(name=p['name'] or p['gn_name'] or '?',type=p['type_en'] or '',iso=p['iso_3166_2'] or p['adm1_code'],g=g,
        alt=[p.get('name_en'),p.get('name_alt'),p.get('woe_name'),p.get('gn_name'),p.get('name_local'),p.get('postal'),hasc]))
# India special: merge PoK pieces
RENAME={'Kashmir':'Ladakh','Azad Kashmir':'Jammu and Kashmir','Northern Areas':'Ladakh','Gilgit-Baltistan':'Ladakh'}
idx={}
for ci,sts in by.items():
    cg=countries[ci]['g']
    if countries[ci]['id']=='IND':
        merged={}
        for s in sts:
            n=RENAME.get(s['name'],s['name'])
            if n in merged: merged[n]['g']=unary_union([merged[n]['g'],s['g']])
            else:
                s=dict(s); s['name']=n
                if n=='Jammu and Kashmir': s['iso']='IN-JK'; s['alt']=['J&K','JK','Jammu & Kashmir','Azad Kashmir','PoK','Pakistan-occupied Kashmir']
                if n=='Ladakh': s['iso']='IN-LA'; s['alt']=['LA','Gilgit-Baltistan','Aksai Chin','Siachen']
                merged[n]=s
        sts=list(merged.values())
    for s in sts: s['g']=make_valid(s['g'].intersection(cg))
    sts=[s for s in sts if not s['g'].is_empty and s['g'].area>1e-6]
    if not sts: continue
    resid=make_valid(cg.difference(unary_union([s['g'] for s in sts])))
    pieces=getattr(resid,'geoms',[resid]) if not resid.is_empty else []
    for pc in pieces:
        if pc.geom_type not in('Polygon','MultiPolygon') or pc.area<1e-7: continue
        b=pc.buffer(0.02)
        best=max(sts,key=lambda s:s['g'].intersection(b).area)
        if best['g'].intersection(b).area==0:
            best=min(sts,key=lambda s:s['g'].distance(pc))
        best['g']=unary_union([best['g'],pc])
    cid=countries[ci]['id']
    fc={'type':'FeatureCollection','features':[{'type':'Feature','properties':{'id':s['iso'],'name':s['name'],'type':s['type'],'alt':altstr(s['name'],s.get('alt',[]))},'geometry':mapping(s['g'])} for s in sts]}
    json.dump(fc,open(f"{out}/a1/{cid}.geojson",'w'))
    idx[cid]=len(sts)
json.dump(idx,open(out+'/a1index.json','w'))
print(len(idx),'countries with subdivisions')
