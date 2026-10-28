using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UnifiedDocuments.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "source_documents",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    source_name = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    source_document_id = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    file_name = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    content_type = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    business_key = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    content_hash = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    modified_at = table.Column<long>(type: "INTEGER", nullable: true),
                    last_seen_at = table.Column<long>(type: "INTEGER", nullable: false),
                    indexed_at = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_source_documents", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "document_vins",
                columns: table => new
                {
                    source_document_id = table.Column<long>(type: "INTEGER", nullable: false),
                    vin = table.Column<string>(type: "TEXT", fixedLength: true, maxLength: 17, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_document_vins", x => new { x.source_document_id, x.vin });
                    table.ForeignKey(
                        name: "fk_document_vins_source_documents_source_document_id",
                        column: x => x.source_document_id,
                        principalTable: "source_documents",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_document_vins_vin",
                table: "document_vins",
                column: "vin");

            migrationBuilder.CreateIndex(
                name: "ix_source_documents_source_name_last_seen_at",
                table: "source_documents",
                columns: new[] { "source_name", "last_seen_at" });

            migrationBuilder.CreateIndex(
                name: "ix_source_documents_source_name_source_document_id",
                table: "source_documents",
                columns: new[] { "source_name", "source_document_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "document_vins");

            migrationBuilder.DropTable(
                name: "source_documents");
        }
    }
}
