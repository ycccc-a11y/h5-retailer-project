Excel to MySQL 导入说明

1. 确保已安装以下Python库:
   - pandas
   - openpyxl
   - pymysql
   - sqlalchemy

   可以通过以下命令安装:
   pip install pandas openpyxl pymysql sqlalchemy

2. 确保MySQL服务已启动

3. 修改 excel_to_mysql.py 中的数据库连接信息:
   - host: MySQL服务器地址
   - user: 数据库用户名
   - password: 数据库密码
   - database: 数据库名称

4. 运行脚本:
   python excel_to_mysql.py

脚本会自动读取"南通市烟草专卖局零售户经纬度.xlsx"文件并将数据导入到MySQL数据库中。