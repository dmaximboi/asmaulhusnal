/* Copy sourced DUAS from web/content.js into Kotlin for the home widget. */
const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'web', 'content.js'), 'utf8');
const start = s.indexOf('const DUAS = [');
const end = s.indexOf('];', start);
if (start < 0 || end < 0) throw new Error('DUAS block not found');
const block = s.slice(start, end + 2);
const ids = [...block.matchAll(/\{id:"([^"]+)"/g)].map(m => m[1]);
const ars = [...block.matchAll(/\n  ar:"([^"]*)"/g)].map(m => m[1]);
const srcs = [...block.matchAll(/\n  src:"([^"]*)"/g)].map(m => m[1]);
if (ids.length !== ars.length || ids.length !== srcs.length) {
  throw new Error('mismatch ' + ids.length + ' ' + ars.length + ' ' + srcs.length);
}
function k(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$');
}
let out = 'package online.digital26.asmaclock\n\nimport java.util.Calendar\n\n';
out += '/** Copied from web/content.js DUAS. Each line keeps its source. Do not invent text. */\n';
out += 'object WidgetDuas {\n';
out += '    data class Item(val id: String, val ar: String, val src: String)\n';
out += '    val ALL = arrayOf(\n';
ids.forEach((id, i) => {
  out += '        Item("' + k(id) + '", "' + k(ars[i]) + '", "' + k(srcs[i]) + '"),\n';
});
out += '    )\n';
out += '    fun pick(now: Calendar): Item {\n';
out += '        val key = now.get(Calendar.YEAR) * 400 + now.get(Calendar.DAY_OF_YEAR)\n';
out += '        return ALL[Math.floorMod(key, ALL.size)]\n';
out += '    }\n';
out += '    fun label(lang: String): String {\n';
out += '        return when (lang) {\n';
out += '            "fr" -> "Priere du jour"\n';
out += '            "ar" -> "الدعاء اليومي"\n';
out += '            else -> "Daily prayer"\n';
out += '        }\n';
out += '    }\n';
out += '}\n';
const dst = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'online', 'digital26', 'asmaclock', 'WidgetDuas.kt');
fs.writeFileSync(dst, out);
console.log('duas', ids.length, dst);
