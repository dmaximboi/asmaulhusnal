package online.digital26.asmaclock;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AsmaAlarmsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
