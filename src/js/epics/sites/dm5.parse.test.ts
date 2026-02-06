import { resolveDm5ImageUrl, unpackPacker } from './dm5';

const PACKER_SAMPLE = String.raw`eval(function(p,a,c,k,e,d){e=function(c){return(c<a?"":e(parseInt(c/a)))+((c=c%a)>35?String.fromCharCode(c+29):c.toString(36))};if(!''.replace(/^/,String)){while(c--)d[e(c)]=k[c]||e(c);k=[function(e){return d[e]}];e=function(){return'\\w+'};c=1;};while(c--)if(k[c])p=p.replace(new RegExp('\\b'+e(c)+'\\b','g'),k[c]);return p;}('b 5(){1 4=3;1 9=\\'8\\';1 7=\"g://f.h.e/a/c/3\";1 2=[\"/j.6\",\"/m.6\"];n(1 i=0;i<2.k;i++){2[i]=7+2[i]+\\'?4=3&9=8\\'}l 2}1 d;d=5();',24,24,'|var|pvalue|1753397|cid|dm5imagefun|jpg|pix|49370fd6fd0f05ca510c4a1a4d389230|key|85|function|84472||com|manhua1040zjcdn123|https|cdndm5||1_4253|length|return|2_8730|for'.split('|'),0,{}))`;

describe('dm5 parser helpers', () => {
  test('unpacks packed payload', () => {
    const unpacked = unpackPacker(PACKER_SAMPLE);
    expect(unpacked).toContain('dm5imagefun');
    expect(unpacked).toContain('pvalue');
  });

  test('resolves image url with query', () => {
    const resolved = resolveDm5ImageUrl(PACKER_SAMPLE, {
      cid: '1753397',
      key: '49370fd6fd0f05ca510c4a1a4d389230',
    });
    expect(resolved).toBe(
      'https://manhua1040zjcdn123.cdndm5.com/85/84472/1753397/1_4253.jpg?cid=1753397&key=49370fd6fd0f05ca510c4a1a4d389230',
    );
  });

  test('falls back to entity key when script omits query', () => {
    const responseText =
      "var d=['/1_4253.jpg']; var base='https://example.com/85/84472/1753397';";
    const resolved = resolveDm5ImageUrl(responseText, {
      cid: '1753397',
      key: 'deadbeef',
    });
    expect(resolved).toBe(
      'https://example.com/85/84472/1753397/1_4253.jpg?cid=1753397&key=deadbeef',
    );
  });
});
