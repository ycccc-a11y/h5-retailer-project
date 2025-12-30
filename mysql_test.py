import pymysql

# 数据库配置 - 请根据您的实际情况修改
config = {
    'host': 'localhost',
    'user': 'root',
    'password': '123456',  # 确保这里设置了正确的密码
    'charset': 'utf8mb3'
}

def test_mysql_connection():
    print("🔍 开始测试MySQL连接...")
    
    try:
        # 尝试连接MySQL服务器
        conn = pymysql.connect(**config)
        print("✅ 成功连接到MySQL服务器!")
        
        # 查询可用的数据库列表
        with conn.cursor() as cursor:
            cursor.execute("SHOW DATABASES")
            databases = cursor.fetchall()
            
            print("\n📋 可用的数据库列表：")
            for i, db in enumerate(databases, 1):
                print(f"   {i}. {db[0]}")
                
    except pymysql.MySQLError as e:
        print(f"❌ MySQL连接失败: {e}")
        print("\n排查建议：")
        print("1. 确保MySQL服务已启动 (可以在任务管理器中查看)")
        print("2. 检查用户名和密码是否正确")
        print("3. 确认root用户有本地连接权限")
        print("4. 检查MySQL是否配置为允许密码验证")
    finally:
        if 'conn' in locals() and conn:
            conn.close()
            print("\n🔒 MySQL连接已关闭")

if __name__ == "__main__":
    test_mysql_connection()