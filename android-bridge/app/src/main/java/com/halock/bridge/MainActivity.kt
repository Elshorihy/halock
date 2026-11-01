package com.halock.bridge

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Color
import android.net.http.SslError
import android.os.Bundle
import android.view.View
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var panel: LinearLayout
    private lateinit var status: TextView
    private lateinit var picker: Spinner
    private lateinit var domain: EditText
    private val devices = mutableListOf<Pair<String, String>>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(18, 22, 18, 18)
            setBackgroundColor(Color.rgb(16, 23, 38))
        }
        fun label(value: String, size: Float = 15f) = TextView(this).apply {
            text = value
            textSize = size
            setTextColor(Color.WHITE)
        }
        root.addView(label("HALOCK Bridge", 26f))
        root.addView(label("وسيط محلي للتحكم في راوتر Huawei"))
        status = label("افتح الراوتر وسجّل الدخول أولًا.")
        root.addView(status)
        root.addView(Button(this).apply {
            text = "فتح الراوتر / تسجيل الدخول"
            setOnClickListener { panel.visibility = View.VISIBLE; web.loadUrl("http://192.168.1.1/") }
        })
        root.addView(Button(this).apply {
            text = "فحص الأجهزة"
            setOnClickListener { scan() }
        })
        picker = Spinner(this)
        root.addView(picker)
        domain = EditText(this).apply {
            hint = "الموقع مثل example.com"
            setSingleLine(true)
            setTextColor(Color.WHITE)
            setHintTextColor(Color.LTGRAY)
        }
        root.addView(domain)
        root.addView(Button(this).apply {
            text = "حظر على الجهاز المحدد"
            setOnClickListener { confirmBlock() }
        })
        root.addView(label("نسخة تجريبية: راجع قائمة الحظر في الراوتر بعد التنفيذ. قد يكون قالب الرقابة الأبوية مشتركًا بين أجهزة أخرى.", 12f))
        panel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; visibility = View.GONE }
        panel.addView(Button(this).apply { text = "إخفاء صفحة الراوتر"; setOnClickListener { panel.visibility = View.GONE } })
        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    return request.url.host != "192.168.1.1"
                }
                override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
                    AlertDialog.Builder(this@MainActivity)
                        .setTitle("شهادة الراوتر")
                        .setMessage("شهادة HTTPS محلية غير موثوقة. تابع فقط إذا كنت متصلًا براوترك المنزلي.")
                        .setNegativeButton("إلغاء") { _, _ -> handler.cancel() }
                        .setPositiveButton("متابعة") { _, _ -> handler.proceed() }
                        .show()
                }
                override fun onPageFinished(view: WebView, url: String) {
                    status.text = "صفحة الراوتر مفتوحة. سجّل الدخول ثم افتح صفحة الرقابة الأبوية."
                }
            }
            layoutParams = LinearLayout.LayoutParams(-1, 440)
        }
        panel.addView(web)
        root.addView(panel)
        setContentView(ScrollView(this).apply { addView(root) })
    }

    private fun scan() {
        val js = """(function(){var roots=[window];try{for(var i=0;i<window.frames.length;i++)roots.push(window.frames[i]);}catch(e){}var a=[];roots.forEach(function(w){try{Array.from(w.document.querySelectorAll('select')).forEach(function(s){Array.from(s.options).forEach(function(o){var t=(o.value+' '+o.textContent);var m=t.match(/[0-9a-f]{2}(?::[0-9a-f]{2}){5}/i);if(m)a.push({name:(o.textContent||m[0]).trim(),mac:m[0].toLowerCase()});});});}catch(e){}});return JSON.stringify(a.filter(function(x,i){return a.findIndex(function(y){return y.mac===x.mac;})===i;}));})()"""
        web.evaluateJavascript(js) { raw ->
            try {
                val decoded = org.json.JSONTokener(raw ?: "[]").nextValue().toString()
                val array = JSONArray(decoded)
                devices.clear()
                for (i in 0 until array.length()) {
                    val item = array.getJSONObject(i)
                    devices.add(Pair(item.optString("name"), item.optString("mac")))
                }
                val rows = if (devices.isEmpty()) listOf("لم يتم العثور على أجهزة — افتح صفحة الرقابة الأبوية") else devices.map { it.first + " (" + it.second + ")" }
                picker.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, rows)
                status.text = if (devices.isEmpty()) "لم أجد قائمة الأجهزة في الصفحة الحالية." else "تم العثور على " + devices.size + " جهاز."
            } catch (_: Exception) {
                status.text = "تعذر قراءة الأجهزة. افتح صفحة الرقابة الأبوية ثم أعد الفحص."
            }
        }
    }

    private fun confirmBlock() {
        val i = picker.selectedItemPosition
        if (i !in devices.indices) { toast("افحص الأجهزة واختر جهازًا أولًا"); return }
        val host = domain.text.toString().trim().lowercase().removePrefix("https://").removePrefix("http://").substringBefore("/")
        if (!host.matches(Regex("(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}"))) {
            toast("اكتب نطاقًا صحيحًا مثل example.com"); return
        }
        val mac = devices[i].second
        AlertDialog.Builder(this).setTitle("تأكيد الحظر")
            .setMessage("إضافة " + host + " للجهاز " + mac + " من خلال صفحة الراوتر؟")
            .setNegativeButton("إلغاء", null)
            .setPositiveButton("حظر") { _, _ -> applyToRouter(mac, host) }.show()
    }

    private fun applyToRouter(mac: String, host: String) {
        val p = JSONObject().put("mac", mac).put("domain", host)
        val js = """(function(p){var roots=[window];try{for(var i=0;i<window.frames.length;i++)roots.push(window.frames[i]);}catch(e){}var w=null,d=null;roots.some(function(x){try{if(typeof x.OnApply==='function'&&typeof x.OnBtAddUrlClick==='function'){w=x;d=x.document;return true;}}catch(e){}return false;});if(!w)return JSON.stringify({ok:false,error:'افتح صفحة Website Filter في الراوتر أولًا'});var ss=Array.from(d.querySelectorAll('select'));var ds=null,op=null;ss.some(function(s){var o=Array.from(s.options).find(function(v){return (v.value+' '+v.textContent).toLowerCase().indexOf(p.mac.toLowerCase())>=0;});if(o){ds=s;op=o;return true;}return false;});var els=Array.from(d.querySelectorAll('input,select'));var scope=els.find(function(x){return String(x.value||'').toUpperCase()==='SPECIFIEDDEVICE';});var url=els.find(function(x){return /url/i.test(x.name+' '+x.id)&&x.type==='text';});if(!ds||!scope||!url)return JSON.stringify({ok:false,error:'لم أجد عناصر الجهاز أو نطاق التصفية أو حقل الموقع'});ds.value=op.value;scope.checked=true;scope.value='SPECIFIEDDEVICE';var mode=els.find(function(x){return /filtermode/i.test(x.name+' '+x.id)&&x.value==='0';});if(mode)mode.checked=true;var enabled=els.find(function(x){return /urlenable/i.test(x.name+' '+x.id);});if(enabled)enabled.checked=true;url.value=p.domain;w.OnApply();setTimeout(function(){try{w.OnBtAddUrlClick();}catch(e){}},400);return JSON.stringify({ok:true,message:'تم استدعاء إجراءات الراوتر. تحقق يدويًا من حفظ قاعدة الحظر.'});})(__PAYLOAD__)""".replace("__PAYLOAD__", p.toString())
        web.evaluateJavascript(js) { raw ->
            val result = try { JSONObject(org.json.JSONTokener(raw ?: "{}").nextValue().toString()) } catch (_: Exception) { JSONObject() }
            status.text = result.optString("message", result.optString("error", "تعذر تأكيد النتيجة"))
            toast(status.text)
        }
    }

    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_LONG).show()
}
