INSERT INTO public.app_settings (key, value) 
VALUES ('low_balance_alert_threshold', '1.0') 
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value) 
VALUES ('admin_notification_email', 'iaprogramador.online@gmail.com') 
ON CONFLICT (key) DO NOTHING;