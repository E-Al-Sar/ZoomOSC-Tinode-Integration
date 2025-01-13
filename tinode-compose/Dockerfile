FROM tinode/tinode:latest

# Set all environment variables exactly as in the running container
ENV STORE_USE_ADAPTER=mysql \
    PPROF_URL=/pprof \
    WAIT_FOR=mysql:3306 \
    TNPG_PUSH_ENABLED=false \
    FCM_PUSH_ENABLED=false \
    FCM_API_KEY=AIzaSyD6X4ULR-RUsobvs1zZ2bHdJuPz39q2tbQ \
    FCM_APP_ID=1:114126160546:web:aca6ea2981feb81fb44dfb \
    FCM_PROJECT_ID=tinode-1000 \
    FCM_SENDER_ID=114126160546 \
    FCM_VAPID_KEY=BOgQVPOMzIMXUpsYGpbVkZoEBc0ifKY_f2kSU5DNDGYI6i6CoKqqxDd7w7PJ3FaGRBgVGJffldETumOx831jl58 \
    FCM_MEASUREMENT_ID=G-WNJDQR34L3 \
    WEBRTC_ENABLED=false \
    RESET_DB=true \
    UPGRADE_DB=false \
    VERSION=0.22.13 \
    TARGET_DB=alldbs \
    NO_DB_INIT=false \
    SAMPLE_DATA=data.json \
    DEFAULT_COUNTRY_CODE=US \
    MYSQL_DSN=root@tcp(mysql)/tinode \
    PLUGIN_PYTHON_CHAT_BOT_ENABLED=false \
    MEDIA_HANDLER=fs \
    FS_CORS_ORIGINS=["*"] \
    AWS_CORS_ORIGINS=["*"] \
    SMTP_HOST_URL=http://localhost:6060 \
    API_KEY_SALT=T713/rYYgW7g4m3vG6zGRh7+FM1t0T8j13koXScOAj4= \
    AUTH_TOKEN_KEY=wfaY2RgF2S1OQI/ZlK+LSrp1KB2jwAdGAIHQ7JZn+Kc= \
    UID_ENCRYPTION_KEY=la6YsO+bNX/+XIkOqc5Svw== \
    TLS_ENABLED=false \
    FCM_INCLUDE_ANDROID_NOTIFICATION=true \
    ACC_GC_ENABLED=false

# Expose all ports used by the container
EXPOSE 6060 12000 12001 12002 12003 16060

WORKDIR /opt/tinode

# Use the same entrypoint as the running container
ENTRYPOINT ["/bin/sh", "-c", "./entrypoint.sh"]

# Add labels for better maintainability
LABEL maintainer="Tinode Team <info@tinode.co>" \
      version="0.22.13" \
      name="TinodeChatServer" 